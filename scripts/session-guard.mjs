#!/usr/bin/env node
/**
 * Local OAuth session guard for Cloudflare operations.
 *
 * Cloudflare decides the real lifetime of its OAuth access tokens, so this
 * script enforces a strict LOCAL session policy on top of it:
 *   - a fresh session is valid for 30 minutes only
 *   - the refresh token is removed, so Wrangler cannot silently renew
 *   - once expired, credentials are scrubbed and a new browser approval
 *     is required before any deploy/DNS command can run
 *
 * Token values are never printed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MODE = process.argv[2] || "check";
const DURATION_MS = 30 * 60 * 1000;
const ROOT = process.cwd();
const SESSION_FILE = path.join(ROOT, ".secrets", "oauth-session.json");

function authConfigPath() {
  const candidates = [
    path.join(os.homedir(), ".wrangler", "config", "default.toml"),
    path.join(process.env.APPDATA || "", "xdg.config", ".wrangler", "config", "default.toml"),
    path.join(process.env.APPDATA || "", ".wrangler", "config", "default.toml"),
    path.join(process.env.LOCALAPPDATA || "", ".wrangler", "config", "default.toml"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || candidates[1];
}

function readSession() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
  } catch {
    return null;
  }
}

function scrubCredentials() {
  const file = authConfigPath();
  if (!file || !fs.existsSync(file)) return false;
  let text = fs.readFileSync(file, "utf8");
  text = text.replace(/^oauth_token\s*=.*$/m, 'oauth_token = ""')
    .replace(/^refresh_token\s*=.*$/m, "")
    .replace(/^expiration_time\s*=.*$/m, 'expiration_time = "1970-01-01T00:00:00Z"');
  fs.writeFileSync(file, text, { mode: 0o600 });
  return true;
}

function startSession() {
  const file = authConfigPath();
  if (!file || !fs.existsSync(file)) {
    console.error("NO_AUTH: run `wrangler login --device` and approve in the browser first.");
    process.exit(2);
  }
  let text = fs.readFileSync(file, "utf8");
  if (!/^oauth_token\s*=\s*"[^"]+"/m.test(text)) {
    console.error("NO_AUTH: no access token found. Approve the browser session first.");
    process.exit(2);
  }

  const now = Date.now();
  const expiresAt = now + DURATION_MS;
  // Remove the refresh token: no automatic renewal after expiry.
  text = text.replace(/^refresh_token\s*=.*\r?\n?/m, "")
    .replace(/^expiration_time\s*=.*$/m, `expiration_time = "${new Date(expiresAt).toISOString()}"`);
  fs.writeFileSync(file, text, { mode: 0o600 });

  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(
    SESSION_FILE,
    JSON.stringify(
      {
        startedAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        durationMinutes: 30,
        autoRenew: false,
        refreshTokenRemoved: true,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
  console.log("SESSION_STARTED duration=30m autoRenew=false refreshToken=removed");
}

function checkSession() {
  const s = readSession();
  if (!s) {
    console.log("NO_SESSION: approve OAuth in the browser, then run `npm run session:start`.");
    return;
  }
  const remaining = new Date(s.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    scrubCredentials();
    fs.rmSync(SESSION_FILE, { force: true });
    console.log("SESSION_EXPIRED: credentials scrubbed. Browser re-approval required.");
    process.exitCode = 3;
    return;
  }
  console.log(
    `SESSION_OK remaining=${Math.ceil(remaining / 60000)}m autoRenew=false`
  );
}

if (MODE === "start") startSession();
else if (MODE === "check" || MODE === "status") checkSession();
else if (MODE === "expire") {
  scrubCredentials();
  fs.rmSync(SESSION_FILE, { force: true });
  console.log("SESSION_ENDED: credentials scrubbed. Browser re-approval required.");
} else {
  console.error("Usage: node scripts/session-guard.mjs [start|check|expire]");
  process.exit(1);
}
