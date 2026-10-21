import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");

test("session cookie uses host-only, HTTPS-only, HttpOnly and SameSite protections", async () => {
  const auth = await read("netlify/functions/auth.mjs");
  assert.match(auth, /__Host-recuperesession=/);
  assert.match(auth, /Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(auth, /Domain=/);
});

test("magic-link tokens are stored hashed, expire, and are consumed with compare-and-swap", async () => {
  const auth = await read("netlify/functions/auth.mjs");
  assert.match(auth, /const raw=token\(\),h=await hash\(raw\)/);
  assert.match(auth, /expiresAt:new Date\(Date\.now\(\)\+900000\)/);
  assert.match(auth, /if\(!m\|\|m\.used\|\|new Date\(m\.expiresAt\)<=new Date\(\)\)return null/);
  assert.match(auth, /setJSON\(key,used,\{onlyIfMatch:current\.etag\}\)/);
  assert.match(auth, /if\(!claimed\.modified\)return null/);
});

test("session lookup hashes the cookie token and rejects expired sessions", async () => {
  const auth = await read("netlify/functions/auth.mjs");
  assert.match(auth, /store\.get\("session\/"\+await hash\(raw\)/);
  assert.match(auth, /if\(!s\|\|new Date\(s\.expiresAt\)<=new Date\(\)\)return null/);
});

test("email templates HTML-escape all user-controlled text fields", async () => {
  const mail = await read("netlify/functions/notifications.mjs");
  for (const field of ["name", "title", "body", "caseNumber"]) {
    assert.ok(mail.includes("escapeHtml(" + field), "must HTML-escape " + field);
  }
  assert.match(mail, /replace\(\/\[&<>"']/);
});

test("test email can only use the server-configured test recipient, not request input", async () => {
  const cases = await read("netlify/functions/cases.mjs");
  const start = cases.indexOf('if (body.action === "send_test_email")');
  const end = cases.indexOf('if (body.action === "prepare_claim")', start);
  assert.ok(start >= 0 && end > start);
  const handler = cases.slice(start, end);
  assert.match(handler, /const recipient = String\(process\.env\.RECUPERE_TEST_EMAIL/);
  assert.doesNotMatch(handler, /to:\s*body\./);
  assert.match(handler, /item\.isTest !== true/);
  assert.match(handler, /customerStoreTouched: false/);
});
