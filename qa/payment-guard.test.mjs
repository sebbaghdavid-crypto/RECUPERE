import test from "node:test";
import assert from "node:assert/strict";
import {paymentConfiguration} from "../netlify/functions/payment-guard.mjs";

test("payments remain disabled by default",()=>{
 assert.deepEqual(paymentConfiguration({secretKey:"sk_test_example",priceId:"price_test123"}),{ok:false,reason:"disabled"});
});

test("payments require an explicit enable flag",()=>{
 assert.equal(paymentConfiguration({enabled:"false",secretKey:"sk_test_example",priceId:"price_test123"}).ok,false);
});

test("live Stripe keys are rejected even when payments are enabled",()=>{
 assert.deepEqual(paymentConfiguration({enabled:"true",secretKey:"sk_live_example",priceId:"price_test123"}),{ok:false,reason:"test_key_required"});
});

test("missing or malformed price IDs fail closed",()=>{
 assert.equal(paymentConfiguration({enabled:"true",secretKey:"sk_test_example"}).ok,false);
 assert.equal(paymentConfiguration({enabled:"true",secretKey:"sk_test_example",priceId:"not-a-price"}).ok,false);
});

test("test-mode payment config requires explicit opt-in and a test key",()=>{
 assert.deepEqual(paymentConfiguration({enabled:"true",secretKey:"sk_test_example",priceId:"price_test123"}),{ok:true,mode:"test"});
});
