import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../simple/index.html", import.meta.url), "utf8");

test("simple claim MVP is a standalone French page with accessible form controls", () => {
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /id="claim-form"/);
  assert.match(html, /id="company"[^>]*required/);
  assert.match(html, /id="category"[^>]*required/);
  assert.match(html, /id="details"[^>]*required/);
  assert.match(html, /aria-live="polite"/);
});

test("simple claim MVP generates a draft locally and offers copy/download", () => {
  assert.match(html, /form\.addEventListener\("submit"/);
  assert.match(html, /navigator\.clipboard\.writeText\(letter\.value\)/);
  assert.match(html, /new Blob\(\[letter\.value\]/);
  assert.match(html, /Aucun courrier n’est envoyé automatiquement/);
});

test("simple claim MVP does not submit or persist user-provided form data", () => {
  assert.doesNotMatch(html, /<form[^>]+action=/i);
  assert.doesNotMatch(html, /fetch\s*\(/i);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /netlify\.functions|stripe|RESEND_API_KEY/i);
});

test("simple claim MVP sets reasonable input length and amount limits", () => {
  assert.match(html, /name="company" maxlength="120"/);
  assert.match(html, /name="details" maxlength="3000"/);
  assert.match(html, /name="amount" type="number" min="0" max="10000000"/);
});
