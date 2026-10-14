import test from "node:test";
import assert from "node:assert/strict";
import {checkoutSessionDisposition} from "../netlify/functions/stripe-webhook-utils.mjs";

test("Stripe webhook retries if checkout session has not been linked to the case yet",()=>{
 assert.equal(checkoutSessionDisposition(undefined,"cs_test_123"),"retry");
 assert.equal(checkoutSessionDisposition({status:"pending"},"cs_test_123"),"retry");
});

test("Stripe webhook processes only the matching checkout session",()=>{
 assert.equal(checkoutSessionDisposition({checkoutSessionId:"cs_test_123"},"cs_test_123"),"match");
 assert.equal(checkoutSessionDisposition({checkoutSessionId:"cs_old_123"},"cs_test_123"),"stale");
});
