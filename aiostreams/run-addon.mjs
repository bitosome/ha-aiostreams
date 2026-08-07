import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_OPTIONS_PATH = "/data/options.json";
const DEFAULT_SECRET_PATH = "/data/secret_key";
const SERVER_PATH = "/app/packages/server/dist/server.js";
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`The ${name} option is required.`);
  }
  return value.trim();
}

export function normalizeBaseUrl(value) {
  const input = requiredString(value, "base_url");
  const url = new URL(input);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("base_url must use http:// or https://.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "base_url cannot contain credentials, a query string, or a fragment.",
    );
  }

  return input.replace(/\/+$/, "");
}

function validateCredentials(usernameValue, passwordValue) {
  const username = requiredString(usernameValue, "admin_username");
  const password = requiredString(passwordValue, "admin_password");

  if (/[:,=\r\n]/.test(username)) {
    throw new Error(
      "admin_username cannot contain a colon, comma, equals sign, or line break.",
    );
  }
  if (/[,\r\n]/.test(password)) {
    throw new Error("admin_password cannot contain a comma or line break.");
  }

  return { username, password };
}

function readPersistedSecret(secretPath) {
  if (!existsSync(secretPath)) return undefined;

  const secret = readFileSync(secretPath, "utf8").trim();
  if (!HEX_KEY.test(secret)) {
    throw new Error(
      `${secretPath} is invalid; restore it from backup instead of generating a new key.`,
    );
  }
  return secret.toLowerCase();
}

export function resolveSecret(requestedValue, secretPath) {
  const persisted = readPersistedSecret(secretPath);
  const requested =
    typeof requestedValue === "string" ? requestedValue.trim().toLowerCase() : "";

  if (requested && !HEX_KEY.test(requested)) {
    throw new Error("secret_key must be empty or exactly 64 hexadecimal characters.");
  }
  if (persisted && requested && persisted !== requested) {
    throw new Error(
      "Refusing to change secret_key because that would make saved AIOStreams configurations unreadable.",
    );
  }
  if (persisted) return persisted;

  const secret = requested || randomBytes(32).toString("hex");
  writeFileSync(secretPath, `${secret}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(secretPath, 0o600);
  console.log(
    requested
      ? "[AIOStreams add-on] Imported and persisted the supplied encryption key."
      : "[AIOStreams add-on] Generated and persisted a new encryption key.",
  );
  return secret;
}

export function buildEnvironment(options, secretPath, currentEnvironment = process.env) {
  const baseUrl = normalizeBaseUrl(options.base_url);
  const { username, password } = validateCredentials(
    options.admin_username,
    options.admin_password,
  );
  const secretKey = resolveSecret(options.secret_key, secretPath);
  const allowedLogLevels = new Set([
    "error",
    "warn",
    "info",
    "http",
    "verbose",
    "debug",
    "silly",
  ]);
  const logLevel = options.log_level || "info";
  if (!allowedLogLevels.has(logLevel)) {
    throw new Error(`Unsupported log_level: ${logLevel}`);
  }

  return {
    ...currentEnvironment,
    NODE_ENV: "production",
    PORT: "3000",
    BASE_URL: baseUrl,
    INTERNAL_URL: "http://127.0.0.1:3000",
    SECRET_KEY: secretKey,
    DATABASE_URI: "sqlite:///data/db.sqlite",
    DISK_CACHE_DIR: "/data/cache",
    SETTINGS_REFRESH_INTERVAL: "0",
    AIOSTREAMS_AUTH: `${username}:${password}`,
    AIOSTREAMS_AUTH_PERMISSIONS: `${username}=admin`,
    AIOSTREAMS_AUTH_REQUIRED: String(options.protect_configure_page !== false),
    LOG_LEVEL: logLevel,
    LOG_FORMAT: "json",
  };
}

export function loadOptions(optionsPath) {
  try {
    return JSON.parse(readFileSync(optionsPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${optionsPath}: ${error.message}`);
  }
}

export function main() {
  const optionsPath = process.env.OPTIONS_PATH || DEFAULT_OPTIONS_PATH;
  const secretPath = process.env.SECRET_KEY_PATH || DEFAULT_SECRET_PATH;
  mkdirSync(new URL(".", pathToFileURL(secretPath)).pathname, { recursive: true });

  const options = loadOptions(optionsPath);
  const environment = buildEnvironment(options, secretPath);

  console.log(`[AIOStreams add-on] Starting with BASE_URL=${environment.BASE_URL}`);
  if (process.env.HA_ADDON_VALIDATE_ONLY === "1") return;

  const child = spawn("/nodejs/bin/node", [SERVER_PATH], {
    env: environment,
    stdio: "inherit",
  });

  let shutdownRequested = false;
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => {
      shutdownRequested = true;
      child.kill(signal);
    });
  }
  child.on("error", (error) => {
    console.error(`[AIOStreams add-on] Failed to start AIOStreams: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal && !shutdownRequested) {
      console.error(`[AIOStreams add-on] AIOStreams stopped after ${signal}.`);
      process.exitCode = 1;
    } else {
      process.exitCode = shutdownRequested ? 0 : (code ?? 1);
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`[AIOStreams add-on] ${error.message}`);
    process.exitCode = 1;
  }
}
