import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
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
// Home Assistant's "Open Web UI" uses ingress: the Supervisor proxies this port
// from its own address only. AIOStreams itself cannot run under the ingress
// path prefix, so this page links to its public base_url instead.
const INGRESS_PORT = 8099;
const INGRESS_PROXY = "172.30.32.2";

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

// The ingress frame is same-origin with Home Assistant, so the page can adopt
// the active Home Assistant theme instead of the device's light/dark setting.
const THEME_SCRIPT =
  "try{var s=getComputedStyle(parent.document.documentElement),r=document.documentElement.style," +
  "m={'--bg':'--primary-background-color','--fg':'--primary-text-color','--muted':'--secondary-text-color'," +
  "'--accent':'--primary-color','--on':'--text-primary-color'};" +
  "for(var k in m){var v=s.getPropertyValue(m[k]).trim();if(v)r.setProperty(k,v)}}catch(e){}";
const THEME_SCRIPT_HASH = createHash("sha256").update(THEME_SCRIPT).digest("base64");
export const LAUNCHER_CSP =
  `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${THEME_SCRIPT_HASH}'; ` +
  "base-uri 'none'; form-action 'none'";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function launcherPage(baseUrl) {
  const base = escapeHtml(baseUrl);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIOStreams</title>
<style>
:root{color-scheme:light dark;--bg:#fafafa;--fg:#212121;--muted:#616161;--accent:#03a9f4;--on:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--fg:#e1e1e1;--muted:#9e9e9e;--accent:#cf9ce8;--on:#1c1b1f}}
html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:420px;margin:0 auto;padding:48px 16px;text-align:center}
h1{font-size:22px;margin:0 0 8px}p{color:var(--muted);margin:0 0 24px;overflow-wrap:anywhere}
a{display:block;margin:12px 0;padding:14px 20px;border-radius:999px;text-decoration:none;font-weight:600}
.primary{background:var(--accent);color:var(--on)}.secondary{border:1px solid var(--muted);color:var(--fg)}
</style>
<script>${THEME_SCRIPT}</script></head><body><main>
<h1>AIOStreams</h1>
<p>Opens ${base} in a new tab.</p>
<a class="primary" href="${base}/dashboard" target="_blank" rel="noopener noreferrer">Open dashboard</a>
<a class="secondary" href="${base}/stremio/configure" target="_blank" rel="noopener noreferrer">Configure Stremio add-on</a>
</main></body></html>
`;
}

export function startLauncher(baseUrl, { port = INGRESS_PORT, allowed = INGRESS_PROXY } = {}) {
  const page = launcherPage(baseUrl);
  const server = createServer((request, response) => {
    const remote = (request.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (allowed && remote !== allowed) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": LAUNCHER_CSP,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : page);
  });
  server.on("error", (error) => {
    console.error(`[AIOStreams add-on] Web UI launcher unavailable: ${error.message}`);
  });
  return server.listen(port);
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
  // A launcher failure is logged and must never stop AIOStreams.
  const launcher = startLauncher(environment.BASE_URL);

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
    launcher.close();
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
