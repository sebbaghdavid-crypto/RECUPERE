import test from "node:test";
import assert from "node:assert/strict";
import registry from "../src/claim-routing/registry.json" with { type: "json" };
import { identifyProviders, validateProviderRecord } from "../src/claim-routing/engine.mjs";

test("the shipped provider registry contains only valid records", () => {
  assert.ok(Array.isArray(registry.providers));
  assert.ok(registry.providers.length >= 2);
  for (const provider of registry.providers) {
    assert.deepEqual(validateProviderRecord(provider), { valid: true, errors: [] }, provider.provider_id);
  }
});

test("an exact merchant name identifies a candidate but still requires confirmation", () => {
  const result = identifyProviders({ merchant: "Fnac" }, registry.providers);
  assert.equal(result.status, "candidates_found");
  assert.equal(result.candidates[0].provider_id, "fnac");
  assert.equal(result.confidence, "high");
  assert.equal(result.needs_clarification, true);
  assert.equal(result.external_action_allowed, false);
});

test("a pasted official HTTPS URL is normalized to its hostname", () => {
  const result = identifyProviders({ merchant_domain: "https://www.fnac.com/aide" }, registry.providers);
  assert.equal(result.candidates[0].provider_id, "fnac");
  assert.equal(result.confidence, "high");
});

test("lookalike domains and credentialed URLs cannot identify an official provider", () => {
  for (const domain of [
    "fnac.com.attacker.example",
    "https://attacker.example@fnac.com",
    "http://fnac.com",
    "ftp://fnac.com"
  ]) {
    const result = identifyProviders({ merchant_domain: domain }, registry.providers);
    assert.equal(result.status, "not_identified", domain);
    assert.equal(result.confidence, "low", domain);
  }
});

test("a reference-number pattern alone remains weak evidence", () => {
  const provider = {
    provider_id: "sample",
    display_name: "Sample Shop",
    official_domains: ["sample.example"],
    official_support_urls: ["https://sample.example/help"],
    official_claim_urls: ["https://sample.example/claim"],
    identifier_patterns: [{ pattern: "^ORD-[0-9]+$", description: "commande" }],
    source_urls: ["https://sample.example/terms"]
  };
  const result = identifyProviders({ order_number: "ORD-12345" }, [provider]);
  assert.equal(result.status, "candidates_found");
  assert.equal(result.confidence, "low");
  assert.equal(result.needs_clarification, true);
  assert.equal(result.external_action_allowed, false);
});

test("official action URLs must be HTTPS and on a declared official domain", () => {
  const base = {
    provider_id: "sample",
    display_name: "Sample Shop",
    official_domains: ["sample.example"],
    official_support_urls: ["https://sample.example/help"],
    official_claim_urls: ["https://sample.example/claim"],
    identifier_patterns: [],
    source_urls: ["https://sample.example/terms"]
  };
  assert.equal(validateProviderRecord(base).valid, true);
  assert.equal(validateProviderRecord({
    ...base,
    official_claim_urls: ["https://sample.example.attacker.example/claim"]
  }).valid, false);
  assert.equal(validateProviderRecord({
    ...base,
    official_support_urls: ["https://attacker.example@sample.example/help"]
  }).valid, false);
  assert.equal(validateProviderRecord({
    ...base,
    source_urls: ["javascript:alert(1)"]
  }).valid, false);
});

test("result links are filtered and no external action is ever performed", () => {
  const provider = {
    provider_id: "sample",
    display_name: "Sample Shop",
    official_domains: ["sample.example"],
    official_support_urls: [
      "https://sample.example/help",
      "https://attacker.example@sample.example/phishing",
      "javascript:alert(1)"
    ],
    official_claim_urls: ["https://sample.example/claim"],
    identifier_patterns: [],
    source_urls: [
      "https://sample.example/terms",
      "http://sample.example/insecure",
      "javascript:alert(1)"
    ]
  };
  const result = identifyProviders({ merchant: "Sample Shop" }, [provider]);
  assert.deepEqual(result.candidates[0].official_urls, [
    "https://sample.example/claim",
    "https://sample.example/help"
  ]);
  assert.deepEqual(result.candidates[0].source_urls, ["https://sample.example/terms"]);
  assert.equal(result.external_action_allowed, false);
});
