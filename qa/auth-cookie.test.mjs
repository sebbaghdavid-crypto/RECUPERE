import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../netlify/functions/auth.mjs", import.meta.url), "utf8");
const portal = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
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
