import test from "node:test";
import assert from "node:assert/strict";
import {statusOf,money,payoutEligible,cashbackShare} from "../netlify/functions/cashback-ledger.mjs";

test("Capitis statuses are normalized without making pending transactions payable",()=>{
  assert.equal(statusOf({status:"pending"}),"PENDING");
  assert.equal(statusOf({status:"approved"}),"APPROVED");
  assert.equal(statusOf({status:"reversed"}),"DECLINED");
  assert.equal(payoutEligible({status:"PENDING",currency:"EUR",cashbackAmount:8,commission:10}),false);
});

test("payout eligibility requires approved status, EUR and a positive amount within commission",()=>{
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:8,commission:10}),true);
  assert.equal(payoutEligible({status:"APPROVED",currency:"USD",cashbackAmount:8,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",cashbackAmount:8,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"",cashbackAmount:8,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:0,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:11,commission:10}),false);
  assert.equal(payoutEligible({status:"APPROVED",currency:"EUR",cashbackAmount:8}),false);
});

test("money rounds to cents and rejects non-finite input",()=>{
  assert.equal(money(1.236),1.24);
  assert.equal(money("not-money"),0);
});

import {customerWasPaid,preserveCustomerPayoutStatus,isLegacyCapitis} from "../netlify/functions/cashback-ledger.mjs";

test("customer payout remains PAID when a Capitis conversion is resynchronized",()=>{
 const row={source:"CAPITIS",status:"APPROVED",payoutStatus:"paid",payoutEligible:true};
 preserveCustomerPayoutStatus(row);
 assert.equal(row.payoutStatus,"PAID");
 assert.equal(customerWasPaid(row),true);
});

test("legacy PAID is migrated only when its source is known to be Capitis",()=>{
 const capitis={source:"CAPITIS",status:"PAID"};
 const unknown={status:"PAID"};
 preserveCustomerPayoutStatus(capitis);
 preserveCustomerPayoutStatus(unknown);
 assert.equal(capitis.payoutStatus,"PAID");
 assert.equal(unknown.payoutStatus,undefined);
 assert.equal(isLegacyCapitis(capitis),true);
 assert.equal(isLegacyCapitis(unknown),false);
});

test("cashback share is bounded and falls back safely for invalid configuration",()=>{
 assert.equal(cashbackShare(80),80);
 assert.equal(cashbackShare(150),100);
 assert.equal(cashbackShare(-10),0);
 assert.equal(cashbackShare("not-a-number"),80);
 assert.equal(cashbackShare(""),80);
 assert.equal(cashbackShare("   "),80);
 assert.equal(cashbackShare(null),80);
});
