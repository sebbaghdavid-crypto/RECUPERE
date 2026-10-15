import test from "node:test";
import assert from "node:assert/strict";
import {sessionCookie} from "../netlify/functions/auth.mjs";

test("session cookie is host-only, secure, and unavailable to JavaScript", () => {
  const cookie = sessionCookie("test-token");
  assert.match(cookie, /^__Host-recuperesession=test-token;/);
  assert.match(cookie, /(?:^|; )Path=\//);
  assert.match(cookie, /(?:^|; )HttpOnly(?:;|$)/);
  assert.match(cookie, /(?:^|; )Secure(?:;|$)/);
  assert.match(cookie, /(?:^|; )SameSite=Lax(?:;|$)/);
  assert.match(cookie, /(?:^|; )Max-Age=604800(?:;|$)/);
  assert.doesNotMatch(cookie, /(?:^|; )Domain=/i);
});

test("logout cookie expires the session cookie immediately", () => {
  const cookie = sessionCookie("", 0);
  assert.match(cookie, /^__Host-recuperesession=;/);
  assert.match(cookie, /(?:^|; )Max-Age=0(?:;|$)/);
  assert.match(cookie, /(?:^|; )Path=\//);
  assert.match(cookie, /(?:^|; )HttpOnly(?:;|$)/);
  assert.match(cookie, /(?:^|; )Secure(?:;|$)/);
});
