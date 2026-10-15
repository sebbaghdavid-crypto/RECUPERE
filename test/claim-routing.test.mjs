import test from "node:test";
import assert from "node:assert/strict";
import { identifyProviders, validateProviderRecord } from "../src/claim-routing/engine.mjs";

const providers = [
  {
    provider_id: "shop-a",
    display_name: "Boutique Exemple",
    legal_name: "Exemple Commerce SAS",
    official_domains: ["boutique-exemple.test"],
    official_support_urls: ["https://boutique-exemple.test/aide"],
    official_claim_urls: ["https://boutique-exemple.test/reclamation"],
    source_urls: ["https://boutique-exemple.test/conditions"],
    checked_at: "2026-10-15",
    identifier_patterns: [{ pattern: "^CMD-[0-9]{6}$", description: "référence CMD à six chiffres" }]
  },
  {
    provider_id: "shop-b",
    display_name: "Autre Boutique",
    official_domains: ["autre-boutique.test"],
    official_support_urls: ["https://autre-boutique.test/contact"],
    official_claim_urls: [],
    source_urls: [],
    identifier_patterns: [{ pattern: "^CMD-[0-9]{6}$", description: "format similaire" }]
  }
];

test("an order number format alone never identifies a provider", () => {
  const result = identifyProviders({ order_number: "CMD-123456" }, providers);
  assert.equal(result.status, "candidates_found");
  assert.equal(result.confidence, "low");
  assert.equal(result.needs_clarification, true);
  assert.equal(result.external_action_allowed, false);
});

test("exact merchant name ranks the candidate and still requires user confirmation", () => {
  const result = identifyProviders({ merchant: "Boutique Exemple", order_number: "CMD-123456" }, providers);
  assert.equal(result.candidates[0].provider_id, "shop-a");
  assert.equal(result.confidence, "high");
  assert.equal(result.needs_clarification, true);
  assert.equal(result.external_action_allowed, false);
});

test("official domain is strong evidence and URLs stay on declared official domains", () => {
  const result = identifyProviders({ merchant_domain: "https://www.boutique-exemple.test", reference: "CMD-123456" }, providers);
  assert.equal(result.candidates[0].provider_id, "shop-a");
  assert.ok(result.candidates[0].official_urls.every((url) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return new URL(url).protocol === "https:" && host === "boutique-exemple.test";
  }));
});

test("unknown merchant produces no guessed provider", () => {
  const result = identifyProviders({ merchant: "Inconnu", invoice_number: "FACT-009" }, providers);
  assert.equal(result.status, "not_identified");
  assert.equal(result.candidates.length, 0);
});

test("registry validation rejects non-HTTPS or off-domain links", () => {
  const result = validateProviderRecord({
    provider_id: "bad",
    display_name: "Bad Provider",
    official_domains: ["trusted.test"],
    official_support_urls: ["https://phishing.test/claim"],
    official_claim_urls: ["http://trusted.test/claim"]
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("invalid registry regex does not crash identification", () => {
  const result = identifyProviders({ order_number: "anything" }, [{
    provider_id: "bad-regex",
    display_name: "Provider",
    official_domains: ["provider.test"],
    identifier_patterns: [{ pattern: "[" }]
  }]);
  assert.equal(result.status, "not_identified");
});
