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
  assert.ok(portal.includes('sessionCookie("",0)'), "logout must expire the cookie");
});

test("magic links have a 15-minute expiry and are claimed atomically", () => {
  assert.ok(source.includes("Date.now()+900000"), "magic link expiry is 15 minutes");
  assert.ok(source.includes("if(!m||m.used||new Date(m.expiresAt)<=new Date())return null"), "used and expired links are rejected");
  assert.ok(source.includes("setJSON(key,used,{onlyIfMatch:current.etag})"), "magic link claim uses compare-and-swap");
  assert.ok(source.includes("if(!claimed.modified)return null"), "a failed concurrent claim is rejected");
});

test("portal dossier lookup is scoped to the authenticated session email", () => {
  assert.ok(portal.includes("findCase(n,s.email)"), "single dossier lookup uses session email");
  assert.ok(portal.includes("return listOwnedCases(email)"), "listing is delegated to owner-scoped lookup");
  assert.ok(portal.includes("return findOwnedCase(email,n)"), "single dossier lookup is delegated to owner-scoped lookup");
});

test("owner lookup rechecks stored email and client results omit access tokens", () => {
  assert.ok(caseStore.includes("String(item.email).toLowerCase()===String(email).toLowerCase()"), "stored dossier email is checked");
  assert.ok(caseStore.includes("const {accessToken,...safe}=item"), "access token is removed from sanitized results");
  assert.ok(caseStore.includes("export async function findOwnedCase(email,caseNumber)"), "public owner-scoped lookup exists");
});
