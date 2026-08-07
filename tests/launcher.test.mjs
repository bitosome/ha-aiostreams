import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildEnvironment,
  normalizeBaseUrl,
  resolveSecret,
} from "../aiostreams/run-addon.mjs";

test("normalizes the public base URL", () => {
  assert.equal(
    normalizeBaseUrl("https://aiostreams.example.com/"),
    "https://aiostreams.example.com",
  );
  assert.throws(() => normalizeBaseUrl("ftp://example.com"), /http:\/\/ or https:\/\//);
});

test("generates and reuses a persisted encryption key", () => {
  const directory = mkdtempSync(join(tmpdir(), "ha-aiostreams-"));
  const secretPath = join(directory, "secret_key");
  const first = resolveSecret("", secretPath);
  const second = resolveSecret("", secretPath);

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(second, first);
  assert.equal(readFileSync(secretPath, "utf8").trim(), first);
});

test("refuses to rotate a persisted encryption key", () => {
  const directory = mkdtempSync(join(tmpdir(), "ha-aiostreams-"));
  const secretPath = join(directory, "secret_key");
  writeFileSync(secretPath, `${"a".repeat(64)}\n`);

  assert.throws(
    () => resolveSecret("b".repeat(64), secretPath),
    /Refusing to change secret_key/,
  );
});

test("maps Home Assistant options to AIOStreams environment variables", () => {
  const directory = mkdtempSync(join(tmpdir(), "ha-aiostreams-"));
  const environment = buildEnvironment(
    {
      base_url: "https://aio.example.com/",
      admin_username: "admin",
      admin_password: "a:strong-password",
      protect_configure_page: true,
      secret_key: "c".repeat(64),
      log_level: "debug",
    },
    join(directory, "secret_key"),
    { TZ: "Europe/Tallinn" },
  );

  assert.equal(environment.BASE_URL, "https://aio.example.com");
  assert.equal(environment.AIOSTREAMS_AUTH, "admin:a:strong-password");
  assert.equal(environment.AIOSTREAMS_AUTH_PERMISSIONS, "admin=admin");
  assert.equal(environment.AIOSTREAMS_AUTH_REQUIRED, "true");
  assert.equal(environment.DATABASE_URI, "sqlite:///data/db.sqlite");
  assert.equal(environment.TZ, "Europe/Tallinn");
});

test("rejects credential separators that AIOStreams cannot encode", () => {
  const directory = mkdtempSync(join(tmpdir(), "ha-aiostreams-"));
  assert.throws(
    () =>
      buildEnvironment(
        {
          base_url: "https://aio.example.com",
          admin_username: "admin",
          admin_password: "not,valid",
          secret_key: "d".repeat(64),
          log_level: "info",
        },
        join(directory, "secret_key"),
      ),
    /cannot contain a comma/,
  );
});
