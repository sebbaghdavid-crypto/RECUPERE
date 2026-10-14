import test from "node:test";
import assert from "node:assert/strict";
import {dedupeRecords,summarizeWallet} from "../netlify/functions/cashback-wallet-ledger.mjs";

test("deduplicates legacy and canonical records, preferring canonical provider keys",()=>{
 const legacy={key:"transaction/abc",tx:{transactionId:"abc",source:"CAPITIS",email:"a@example.com",status:"APPROVED",cashbackAmount:8,currency:"EUR",payoutEligible:true}};
 const canonical={key:"transaction/capitis/abc",tx:{transactionId:"abc",source:"CAPITIS",email:"a@example.com",status:"APPROVED",cashbackAmount:8,currency:"EUR",payoutEligible:true}};
 const rows=dedupeRecords([legacy,canonical]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].key,canonical.key);
});

test("keeps same transaction IDs from different affiliate sources separate",()=>{
 const rows=dedupeRecords([
  {key:"transaction/capitis/42",tx:{transactionId:"42",source:"CAPITIS"}},
  {key:"transaction/awin/42",tx:{transactionId:"42",source:"AWIN"}}
 ]);
 assert.equal(rows.length,2);
});

test("provider approved status is not interpreted as customer payout unless payout state is explicit",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/1",tx:{transactionId:"1",source:"CAPITIS",status:"APPROVED",providerStatus:"APPROVED",cashbackAmount:8,commission:10,currency:"EUR",payoutEligible:true}},
  {key:"transaction/capitis/2",tx:{transactionId:"2",source:"CAPITIS",status:"APPROVED",providerStatus:"APPROVED",payoutStatus:"PAID",cashbackAmount:5,currency:"EUR",payoutEligible:false}}
 ],10);
 assert.equal(summary.approved,8);
 assert.equal(summary.paid,5);
 assert.equal(summary.payoutEligible,false);
});

test("ambiguous historical PAID and unknown sources are excluded from balances for review",()=>{
 const summary=summarizeWallet([
  {key:"transaction/legacy",tx:{transactionId:"legacy",status:"PAID",cashbackAmount:99,currency:"EUR"}},
  {key:"transaction/mystery/x",tx:{transactionId:"x",source:"MYSTERY",status:"APPROVED",cashbackAmount:50,currency:"EUR",payoutEligible:true}}
 ],10);
 assert.equal(summary.approved,0);
 assert.equal(summary.paid,0);
 assert.ok(summary.transactions.every(x=>x.status==="REVIEW_REQUIRED"));
});

test("pending conversions cannot become payable and amounts are rounded",()=>{
 const summary=summarizeWallet([
  {key:"transaction/awin/p",tx:{transactionId:"p",source:"AWIN",status:"PENDING",cashbackAmount:4.236,currency:"EUR",payoutEligible:false}}
 ],10);
 assert.equal(summary.pending,4.24);
 assert.equal(summary.approved,0);
 assert.equal(summary.payoutEligible,false);
});

test("foreign-currency transactions are excluded from EUR balances and flagged for review",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/usd",tx:{transactionId:"usd",source:"CAPITIS",status:"PENDING",providerStatus:"PENDING",cashbackAmount:25,currency:"USD",payoutEligible:false}}
 ],10);
 assert.equal(summary.pending,0);
 assert.equal(summary.approved,0);
 assert.equal(summary.paid,0);
 assert.equal(summary.transactions[0].status,"REVIEW_REQUIRED");
 assert.equal(summary.transactions[0].payoutStatus,"REVIEW_REQUIRED");
});

test("transactions with missing currency are excluded from EUR balances and flagged for review",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/no-currency",tx:{transactionId:"no-currency",source:"CAPITIS",status:"APPROVED",providerStatus:"APPROVED",cashbackAmount:12,currency:"",payoutEligible:true}}
 ],10);
 assert.equal(summary.pending,0);
 assert.equal(summary.approved,0);
 assert.equal(summary.paid,0);
 assert.equal(summary.transactions[0].status,"REVIEW_REQUIRED");
 assert.equal(summary.transactions[0].payoutStatus,"REVIEW_REQUIRED");
});

test("legacy PAID is flagged for review when payout status is present but provider status is missing",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/legacy-paid",tx:{transactionId:"legacy-paid",source:"CAPITIS",status:"PAID",payoutStatus:"NOT_PAID",cashbackAmount:40,currency:"EUR",payoutEligible:true}}
 ],10);
 assert.equal(summary.approved,0);
 assert.equal(summary.paid,0);
 assert.equal(summary.transactions[0].status,"REVIEW_REQUIRED");
 assert.equal(summary.transactions[0].payoutStatus,"REVIEW_REQUIRED");
});

test("payout status PAID without explicit provider status is flagged and not counted as paid",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/ambiguous-paid",tx:{transactionId:"ambiguous-paid",source:"CAPITIS",status:"APPROVED",payoutStatus:"PAID",cashbackAmount:15,currency:"EUR",payoutEligible:false}}
 ],10);
 assert.equal(summary.approved,0);
 assert.equal(summary.paid,0);
 assert.equal(summary.transactions[0].status,"REVIEW_REQUIRED");
 assert.equal(summary.transactions[0].payoutStatus,"REVIEW_REQUIRED");
});

test("negative cashback amounts cannot reduce wallet balances",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/negative",tx:{transactionId:"negative",source:"CAPITIS",status:"APPROVED",providerStatus:"APPROVED",cashbackAmount:-25,currency:"EUR",payoutEligible:true}}
 ],10);
 assert.equal(summary.approved,0);
 assert.equal(summary.transactions[0].cashbackAmount,0);
});

test("invalid minimum payout configuration falls back to ten euros",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/amount",tx:{transactionId:"amount",source:"CAPITIS",status:"APPROVED",providerStatus:"APPROVED",cashbackAmount:8,currency:"EUR",payoutEligible:true}}
 ],"not-a-number");
 assert.equal(summary.minimumPayout,10);
 assert.equal(summary.payoutEligible,false);
});

test("payout marked PAID with a non-approved provider conversion is flagged for review",()=>{
 const summary=summarizeWallet([
  {key:"transaction/capitis/provider-pending",tx:{transactionId:"provider-pending",source:"CAPITIS",status:"PENDING",providerStatus:"PENDING",payoutStatus:"PAID",cashbackAmount:15,currency:"EUR",payoutEligible:false}}
 ],10);
 assert.equal(summary.paid,0);
 assert.equal(summary.transactions[0].status,"REVIEW_REQUIRED");
 assert.equal(summary.transactions[0].payoutStatus,"REVIEW_REQUIRED");
});

test("zero minimum payout configuration falls back to ten euros",()=>{
 const summary=summarizeWallet([],0);
 assert.equal(summary.minimumPayout,10);
 assert.equal(summary.payoutEligible,false);
});
