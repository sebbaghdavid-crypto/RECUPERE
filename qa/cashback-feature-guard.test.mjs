import test from "node:test";
import assert from "node:assert/strict";
import {cashbackPublicEnabled,cashbackSyncEnabled} from "../netlify/functions/cashback-feature-guard.mjs";

test("cashback public feature is disabled by default",()=>{
 assert.equal(cashbackPublicEnabled({}),false);
 assert.equal(cashbackPublicEnabled({RECUPERE_CASHBACK_ENABLED:"false"}),false);
 assert.equal(cashbackPublicEnabled({RECUPERE_CASHBACK_ENABLED:"true"}),true);
});

test("Capitis sync requires both explicit feature and sync opt-ins",()=>{
 assert.equal(cashbackSyncEnabled({}),false);
 assert.equal(cashbackSyncEnabled({RECUPERE_CASHBACK_ENABLED:"true"}),false);
 assert.equal(cashbackSyncEnabled({RECUPERE_CASHBACK_SYNC_ENABLED:"true"}),false);
 assert.equal(cashbackSyncEnabled({RECUPERE_CASHBACK_ENABLED:"true",RECUPERE_CASHBACK_SYNC_ENABLED:"true"}),true);
});
