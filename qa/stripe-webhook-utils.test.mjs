import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSessionDisposition } from "../netlify/functions/stripe-webhook-utils.mjs";

test("webhook retries when checkout has not yet been linked to the dossier", () => {
  assert.equal(checkoutSessionDisposition(undefined, "cs_test_123"), "retry");
  assert.equal(checkoutSessionDisposition({}, "cs_test_123"), "retry");
});

test("webhook accepts only the checkout session linked to the dossier", () => {
  assert.equal(checkoutSessionDisposition({ checkoutSessionId: "cs_test_123" }, "cs_test_123"), "match");
});

test("webhook ignores an event for an older or unrelated checkout session", () => {
  assert.equal(checkoutSessionDisposition({ checkoutSessionId: "cs_test_current" }, "cs_test_old"), "stale");
});
