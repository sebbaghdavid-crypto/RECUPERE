import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");

test("isolated persistence test is admin-protected and uses only the test store", () => {
  const create = source.slice(source.indexOf('if (body.action === "create_test")'), source.indexOf('if (body.action === "verify_test")'));
  const verify = source.slice(source.indexOf('if (body.action === "verify_test")'), source.indexOf('if (body.action === "send_test_email")'));
  assert.match(create, /adminOk\(req\)/);
  assert.match(create, /testStore\.setJSON/);
  assert.doesNotMatch(create, /store\.setJSON|sendCustomerEmail|fetch\(/);
  assert.match(create, /emailSent:\s*false/);
  assert.match(verify, /adminOk\(req\)/);
  assert.match(verify, /testStore\.get/);
  assert.match(verify, /persisted:\s*true/);
  assert.match(verify, /emailSent:\s*false/);
  assert.match(verify, /supplierSent:\s*false/);
});

test("test email is separately guarded and uses a configured test recipient", () => {
  const start = source.indexOf('if (body.action === "send_test_email")');
  const end = source.indexOf('if (body.action === "prepare_claim")');
  assert.ok(start >= 0 && end > start);
  const email = source.slice(start, end);
  assert.match(email, /adminOk\(req\)/);
  assert.match(email, /testStore\.get/);
  assert.match(email, /item\.isTest !== true/);
  assert.match(email, /RECUPERE_TEST_EMAIL/);
  assert.match(email, /endsWith\("\.invalid"\)/);
  assert.match(email, /inboxReceiptVerified:\s*false/);
  assert.match(email, /customerStoreTouched:\s*false/);
  assert.match(email, /supplierSent:\s*false/);
});
