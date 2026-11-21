import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildEnvironment,
  LAUNCHER_CSP,
  launcherPage,
  normalizeBaseUrl,
  resolveSecret,
  startLauncher,
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

test("web UI page links to the public dashboard and escapes the URL", () => {
  const page = launcherPage("https://aiostreams.example.com");
  assert.match(page, /href="https:\/\/aiostreams\.example\.com\/dashboard" target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /href="https:\/\/aiostreams\.example\.com\/stremio\/configure"/);
  const hostile = launcherPage('https://x.example/"><script>alert(1)</script>');
  assert.equal(hostile.match(/<script/g).length, 1);
  assert.match(hostile, /&#34;&#62;&#60;script&#62;alert\(1\)/);
});

test("web UI launcher answers only the ingress proxy", async () => {
  const listen = (allowed) =>
    new Promise((resolve) => {
      const server = startLauncher("https://aiostreams.example.com", { port: 0, allowed });
      server.on("listening", () => resolve(server));
    });
  const url = (server) => `http://127.0.0.1:${server.address().port}/`;

  const open = await listen("127.0.0.1");
  const response = await fetch(url(open));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(await response.text(), /Open dashboard/);
  assert.equal((await fetch(url(open), { method: "POST" })).status, 405);
  open.close();

  const closed = await listen("172.30.32.2");
  assert.equal((await fetch(url(closed))).status, 403);
  closed.close();
});

test("web UI page needs no viewport height and allows only its own theme script", () => {
  const page = launcherPage("https://aiostreams.example.com");
  assert.doesNotMatch(page, /\bvh\b/);
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hash = createHash("sha256").update(script).digest("base64");
  assert.match(LAUNCHER_CSP, new RegExp(`script-src 'sha256-${hash.replace(/[+/=]/g, "\\$&")}'`));
  assert.equal(page.match(/<script/g).length, 1);
});
