import test from "node:test";
import assert from "node:assert/strict";
import {statusOf,money,payoutEligible} from "../netlify/functions/cashback-ledger.mjs";

test("Capitis statuses are normalized without making pending transactions payable",()=>{
  assert.equal(statusOf({status:"pending"}),"PENDING");
  assert.equal(statusOf({status:"approved"}),"APPROVED");
  assert.equal(statusOf({status:"reversed"}),"DECLINED");
  assert.equal(payoutEligible({status:"PENDING",currency:"EUR",cashbackAmount:8,commission:10}),false);
});

test("payout eligibility requires approved status, EUR and a positive amount within commission",()=>{
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:8,commission:10}),true);
  assert.equal(payoutEligible({status:"APPROVED",currency:"USD",cashbackAmount:8,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:0,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:11,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:8}),false);
});

test("money rounds to cents and rejects non-finite input",()=>{
  assert.equal(money(1.236),1.24);
  assert.equal(money("not-money"),0);
});
