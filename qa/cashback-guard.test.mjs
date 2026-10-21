import assert from "node:assert/strict";
import test from "node:test";
import { cashbackPublicEnabled, cashbackSyncEnabled } from "../netlify/functions/cashback-feature-guard.mjs";

test("cashback is disabled when no explicit flag is configured", () => {
  assert.equal(cashbackPublicEnabled({}), false);
  assert.equal(cashbackSyncEnabled({}), false);
});

test("cashback public access requires the exact true flag", () => {
  for (const value of ["", "false", "TRUE", "1", "yes", undefined]) {
    assert.equal(cashbackPublicEnabled({ RECUPERE_CASHBACK_ENABLED: value }), false);
  }
  assert.equal(cashbackPublicEnabled({ RECUPERE_CASHBACK_ENABLED: "true" }), true);
});

test("cashback sync requires both public and sync flags", () => {
  assert.equal(cashbackSyncEnabled({ RECUPERE_CASHBACK_ENABLED: "true" }), false);
  assert.equal(cashbackSyncEnabled({ RECUPERE_CASHBACK_SYNC_ENABLED: "true" }), false);
  assert.equal(cashbackSyncEnabled({ RECUPERE_CASHBACK_ENABLED: "true", RECUPERE_CASHBACK_SYNC_ENABLED: "false" }), false);
  assert.equal(cashbackSyncEnabled({ RECUPERE_CASHBACK_ENABLED: "true", RECUPERE_CASHBACK_SYNC_ENABLED: "true" }), true);
});
