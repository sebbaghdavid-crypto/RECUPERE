import assert from "node:assert/strict";
import test from "node:test";
import { paymentConfiguration } from "../netlify/functions/payment-guard.mjs";

test("payment configuration fails closed for absent or unexpected opt-in values", () => {
  for (const enabled of [undefined, "", "false", "TRUE", "1", "yes"]) {
    assert.equal(paymentConfiguration({ enabled, secretKey: "sk_test_example", priceId: "price_123abc" }).ok, false);
  }
});

test("only test-mode Stripe secret keys are accepted", () => {
  for (const secretKey of [undefined, "", "sk_live_example", "rk_test_example", "pk_test_example", "sk_test_"]) {
    assert.equal(paymentConfiguration({ enabled: "true", secretKey, priceId: "price_123abc" }).ok, false);
  }
  assert.equal(paymentConfiguration({ enabled: "true", secretKey: "sk_test_example", priceId: "price_123abc" }).ok, true);
});

test("price ID must have a syntactically valid Stripe Price shape", () => {
  for (const priceId of [undefined, "", "prod_123abc", "price_", "price_bad-value", "price_123 abc"]) {
    assert.equal(paymentConfiguration({ enabled: "true", secretKey: "sk_test_example", priceId }).ok, false);
  }
  assert.equal(paymentConfiguration({ enabled: "true", secretKey: "sk_test_example", priceId: "price_123abc" }).ok, true);
});
