import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("technical test cases use a separate store and require admin authentication", async () => {
  const source = await readFile(join(root, "netlify/functions/cases.mjs"), "utf8");
  assert.match(source, /const testStore = getStore\(\{ name: "recupere-cases-test"/);
  assert.match(source, /if \(body\.action === "create_test"\)[\s\S]*?if \(!adminOk\(req\)\) return response\(\{ error: "Accès administrateur refusé\." \}, 401\);[\s\S]*?testStore\.setJSON\(\`test\/\$\{caseNumber\}\`, item, \{ onlyIfNew: true \}\)/);
  assert.match(source, /if \(body\.action === "verify_test"\)[\s\S]*?if \(!adminOk\(req\)\) return response\(\{ error: "Accès administrateur refusé\." \}, 401\);[\s\S]*?testStore\.get\(\`test\/\$\{caseNumber\}\`, \{ type: "json", consistency: "strong" \}\)/);
});

test("technical test email is restricted to the configured test recipient", async () => {
  const source = await readFile(join(root, "netlify/functions/cases.mjs"), "utf8");
  const start = source.indexOf('if (body.action === "send_test_email")');
  const end = source.indexOf('if (body.action === "prepare_claim")', start);
  assert.ok(start >= 0 && end > start, "send_test_email handler must exist");
  const handler = source.slice(start, end);
  assert.match(handler, /if \(!adminOk\(req\)\)/);
  assert.match(handler, /testStore\.get\(\`test\/\$\{caseNumber\}\`, \{ type: "json", consistency: "strong" \}\)/);
  assert.match(handler, /item\.isTest !== true/);
  assert.match(handler, /process\.env\.RECUPERE_TEST_EMAIL/);
  assert.match(handler, /recipient\.endsWith\("\.invalid"\)/);
  assert.match(handler, /to: recipient/);
  assert.match(handler, /idempotencyKey: \`test-email\|\$\{caseNumber\}\`/);
  assert.match(handler, /customerStoreTouched: false/);
  assert.match(handler, /supplierSent: false/);
  assert.doesNotMatch(handler, /store\.setJSON\(\`case\//, "test email must not write to the customer case store");
});

test("test email configuration fails closed when the recipient is missing", async () => {
  const source = await readFile(join(root, "netlify/functions/cases.mjs"), "utf8");
  assert.match(source, /if \(!recipient \|\| !\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//);
  assert.match(source, /Adresse de test non configurée\. Aucun e-mail envoyé\./);
});
