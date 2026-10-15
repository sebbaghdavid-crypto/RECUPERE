import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../netlify/functions/auth.mjs", import.meta.url), "utf8");
const portal = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
const caseStore = readFileSync(new URL("../netlify/functions/case-store.mjs", import.meta.url), "utf8");
const declaration = source.match(/export const sessionCookie=.*$/m)?.[0];

test("session cookie is host-only, secure, and unavailable to JavaScript", () => {
  assert.ok(declaration, "sessionCookie declaration exists");
  assert.match(declaration, /__Host-recuperesession=\$\{value\}/);
  assert.match(declaration, /Max-Age=\$\{maxAge\}/);
  assert.match(declaration, /Path=\//);
  assert.match(declaration, /HttpOnly/);
  assert.match(declaration, /Secure/);
  assert.match(declaration, /SameSite=Lax/);
  assert.doesNotMatch(declaration, /Domain=/i);
});

test("logout expires the session cookie immediately", () => {
  assert.match(declaration, /maxAge=604800/);
  assert.match(portal, /sessionCookie\("",0\)/);
});

test("magic links expire after 15 minutes and are claimed with compare-and-swap", () => {
  assert.match(source, /Date\.now\(\)\+900000/);
  assert.match(source, /if\(!m\|\|m\.used\|\|new Date\(m\.expiresAt\)<=new Date\(\)\)return null/);
  assert.match(source, /setJSON\(key,used,\{onlyIfMatch:current\.etag\}\)/);
  assert.match(source, /if\(!claimed\.modified\)return null/);
});

test("portal dossier lookup always supplies the authenticated session email", () => {
  assert.match(portal, /findCase\(n,s\.email\)/);
  assert.match(portal, /listOwnedCases\(email\)/);
  assert.match(portal, /findOwnedCase\(email,caseNumber\)/);
});

test("owner index lookup rechecks the stored dossier email and strips access tokens from client results", () => {
  assert.match(caseStore, /String\(item\.email\)\.toLowerCase\(\)===String\(email\)\.toLowerCase\(\)/);
  assert.match(caseStore, /const \{accessToken,\.\.\.safe\}=item/);
  assert.match(caseStore, /export async function findOwnedCase\(email,caseNumber\)/);
});
