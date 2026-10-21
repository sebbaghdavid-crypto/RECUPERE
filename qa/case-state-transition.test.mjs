import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, initialCaseStatus } from "../netlify/functions/case-state.mjs";

test("new dossiers start in analysis and cannot skip payment gates", () => {
  assert.equal(initialCaseStatus(), "ANALYSIS");
  assert.equal(canTransition("NEW", "ANALYSIS"), true);
  assert.equal(canTransition("NEW", "PAID"), false);
  assert.equal(canTransition("ANALYSIS", "SENT"), false);
  assert.equal(canTransition("OPPORTUNITY", "RECOVERED"), false);
});

test("payment and claim lifecycle requires the expected progression", () => {
  assert.equal(canTransition("PAYMENT_REQUIRED", "PAID"), true);
  assert.equal(canTransition("PAID", "CLAIM_PREPARED"), true);
  assert.equal(canTransition("CLAIM_PREPARED", "SENT"), true);
  assert.equal(canTransition("SENT", "FOLLOW_UP"), true);
  assert.equal(canTransition("FOLLOW_UP", "RECOVERED"), true);
  assert.equal(canTransition("RECOVERED", "CLOSED"), true);
});

test("closed and recovered dossiers cannot be reopened or moved backwards", () => {
  assert.equal(canTransition("CLOSED", "PAID"), false);
  assert.equal(canTransition("CLOSED", "SENT"), false);
  assert.equal(canTransition("RECOVERED", "SENT"), false);
  assert.equal(canTransition("NO_OPPORTUNITY", "PAID"), false);
  assert.equal(canTransition("CANCELLED", "PAYMENT_REQUIRED"), false);
});

test("refunds cannot be silently reversed into paid or claim states", () => {
  assert.equal(canTransition("REFUNDED", "PAID"), false);
  assert.equal(canTransition("REFUNDED", "CLAIM_PREPARED"), false);
  assert.equal(canTransition("REFUNDED", "CLOSED"), true);
});

test("same-state transitions are idempotently permitted", () => {
  for (const status of ["ANALYSIS", "PAYMENT_REQUIRED", "PAID", "SENT", "CLOSED"]) {
    assert.equal(canTransition(status, status), true);
  }
});
