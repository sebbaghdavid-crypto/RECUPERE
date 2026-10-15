import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { identifyProviders, validateProviderRecord } from "../src/claim-routing/engine.mjs";
import registry from "../src/claim-routing/registry.json" with { type: "json" };

const providers = [
  {
    provider_id: "shop-a",
    display_name: "Boutique Exemple",
    legal_name: "Exemple Commerce SAS",
    official_domains: ["boutique-exemple.test"],
    official_support_urls: ["https://boutique-exemple.test/aide"],
    official_claim_urls: ["https://boutique-exemple.test/reclamation"],
    source_urls: ["https://www.service-public.gouv.fr/particuliers/vosdroits/F10868"],
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
  assert.ok(result.candidates[0].source_urls.includes("https://www.service-public.gouv.fr/particuliers/vosdroits/F10868"));
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

test("curated registry entries pass official URL validation", () => {
  assert.ok(Array.isArray(registry.providers));
  assert.ok(registry.providers.length >= 2);
  for (const provider of registry.providers) {
    const result = validateProviderRecord(provider);
    assert.equal(result.valid, true, `${provider.provider_id}: ${result.errors.join(", ")}`);
  }
});

test("official merchant domain selects the matching curated provider", () => {
  const result = identifyProviders({
    merchant: "SNCF Connect",
    merchant_domain: "https://www.sncf-connect.com",
    order_number: "AB123456"
  }, registry.providers);
  assert.equal(result.candidates[0].provider_id, "sncf-connect");
  assert.equal(result.confidence, "high");
  assert.equal(result.external_action_allowed, false);
});

test("provider registry keeps public authority sources separate from merchant URLs", () => {
  const fnac = registry.providers.find((provider) => provider.provider_id === "fnac");
  assert.ok(fnac);
  assert.ok(fnac.source_urls.some((url) => new URL(url).hostname.endsWith("gouv.fr")));
});

test("routing endpoint requires session, consent, bounded body and rate limiting", async () => {
  const source = await readFile(new URL("../netlify/functions/claim-routing.mjs", import.meta.url), "utf8");
  assert.match(source, /getSession\(req\)/);
  assert.match(source, /allowClaimRoutingRequest\(session\.email, ipFor\(req\)\)/);
  assert.match(source, /hasConsent\(body\.consent\)/);
  assert.match(source, /MAX_BODY_BYTES\s*=\s*16_384/);
  assert.match(source, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength/);
  assert.match(source, /persisted:\s*false/);
  assert.match(source, /external_action_performed:\s*false/);
  assert.match(source, /Do not log user-supplied order numbers/);
  assert.ok(source.indexOf("hasConsent(body.consent)") < source.indexOf("allowClaimRoutingRequest(session.email, ipFor(req))"),
    "validate consent before consuming rate-limit quota");
});

test("provider routing rate limits both account and IP", async () => {
  const source = await readFile(new URL("../netlify/functions/auth.mjs", import.meta.url), "utf8");
  assert.match(source, /rateLimit\("claim-routing-email",e,20\)/);
  assert.match(source, /rateLimit\("claim-routing-ip",i,40\)/);
});
