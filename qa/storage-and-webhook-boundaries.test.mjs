import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = async (relative) => readFile(join(root, relative), "utf8");

test("case storage uses compare-and-swap instead of blind writes for concurrent updates", async () => {
  const store = await source("netlify/functions/case-store.mjs");
  assert.match(store, /getWithMetadata\(key,\{type:"json",consistency:"strong"\}\)/);
  assert.match(store, /setJSON\(key,next,\{onlyIfMatch:current\.etag\}\)/);
  assert.match(store, /for\(let i=0;i<retries;i\+\+\)/);
  assert.match(store, /return \{ok:false,reason:"conflict"\}/);
  assert.match(store, /structuredClone\(before\)/);
});

test("rate limiting uses hashed identifiers and conditional writes", async () => {
  const auth = await source("netlify/functions/auth.mjs");
  assert.match(auth, /safe=await hash\(String\(key\|\|""\)\)/);
  assert.match(auth, /getWithMetadata\(k,\{type:"json",consistency:"strong"\}\)/);
  assert.match(auth, /setJSON\(k,value,\{onlyIfMatch:current\.etag\}\)/);
  assert.match(auth, /setJSON\(k,value,\{onlyIfNew:true\}\)/);
  assert.match(auth, /attempt<4/);
  assert.match(auth, /allowCaseCreate\(email,ip\)/);
});

test("Stripe webhook verifies the signature and timestamp before interpreting events", async () => {
  const webhook = await source("netlify/functions/stripe-webhook.mjs");
  const signatureCheck = webhook.indexOf("verifySignature(rawBody,req.headers.get(");
  const parseEvent = webhook.indexOf("JSON.parse(rawBody)");
  assert.ok(signatureCheck >= 0 && parseEvent > signatureCheck, "must verify signature before parsing/handling event");
  assert.match(webhook, /age>300/);
  assert.match(webhook, /crypto\.timingSafeEqual/);
  assert.match(webhook, /if\(!await claimEvent\(eventId\)\)/);
  assert.match(webhook, /paidAmount!==990/);
  assert.match(webhook, /paidCurrency!=="eur"/);
  assert.match(webhook, /checkoutSessionDisposition\(item\.payment,session\.id\)/);
});

test("payment endpoint is bound to an authenticated owner and a payable status", async () => {
  const payment = await source("netlify/functions/payment.mjs");
  assert.match(payment, /if \(!PAYMENT_CONFIGURATION\.ok\)/);
  assert.match(payment, /const session = await getSession\(req\)/);
  assert.match(payment, /findOwnedCaseRaw\(session\.email,caseNumber\)/);
  assert.match(payment, /item\.status !== "PAYMENT_REQUIRED"/);
  assert.match(payment, /item\.payment\?\.status === "paid" \|\| item\.status === "PAID"/);
  assert.match(payment, /reusedCheckout: true/);
});
