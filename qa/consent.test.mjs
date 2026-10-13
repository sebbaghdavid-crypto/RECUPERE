import test from "node:test";
import assert from "node:assert/strict";
import {hasConsent} from "../netlify/functions/consent.mjs";

test("case intake requires explicit affirmative consent",()=>{
 assert.equal(hasConsent(true),true);
 assert.equal(hasConsent(false),false);
 assert.equal(hasConsent("on"),false);
 assert.equal(hasConsent(undefined),false);
});
