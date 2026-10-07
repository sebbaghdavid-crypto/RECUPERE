import test from "node:test";
import assert from "node:assert/strict";
import { statusOf, money } from "../netlify/functions/cashback-ledger.mjs";

test("only validated statuses can become APPROVED",()=>{
  assert.equal(statusOf({status:"APPROVED"}),"APPROVED");
  assert.equal(statusOf({status:"PAYABLE"}),"APPROVED");
  assert.equal(statusOf({status:"PENDING"}),"PENDING");
});

test("paid and declined states are explicit",()=>{
  assert.equal(statusOf({status:"PAID"}),"PAID");
  assert.equal(statusOf({status:"SETTLED"}),"PAID");
  assert.equal(statusOf({status:"DECLINED"}),"DECLINED");
  assert.equal(statusOf({status:"REVERSED"}),"DECLINED");
});

test("money normalizes precision and rejects non-numbers",()=>{
  assert.equal(money(12.345),12.35);
  assert.equal(money("8.1"),8.1);
  assert.equal(money("not-a-number"),0);
});
