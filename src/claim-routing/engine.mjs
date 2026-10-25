const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeDomain = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    // A domain field may contain a pasted HTTPS URL, but never credentials
    // or a non-HTTPS scheme that could be misread as an official domain.
    if ((hasScheme && url.protocol !== "https:") || url.username || url.password) return "";
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

const safeHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};

const safeOfficialUrl = (value, officialDomains = []) => {
  try {
    const url = new URL(value);
    if (!safeHttpsUrl(value)) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return officialDomains.some((domain) => {
      const normalized = normalizeDomain(domain);
      return normalized && (host === normalized || host.endsWith(`.${normalized}`));
    });
  } catch {
    return false;
  }
};

const hasValue = (value) => String(value ?? "").trim().length > 0;

/**
 * Rank possible providers using explainable, deterministic evidence.
 * An order/invoice number pattern is intentionally weak and can never
 * identify a provider by itself.
 *
 * provider schema:
 * { provider_id, display_name, legal_name?, official_domains[],
 *   official_support_urls[], official_claim_urls[], identifier_patterns[],
 *   source_urls[], checked_at? }
 */
export function identifyProviders(input = {}, providers = []) {
  const merchant = normalize(input.merchant);
  const domain = normalizeDomain(input.merchant_domain || input.email_domain);
  const reference = String(input.order_number || input.invoice_number || input.reference || "").trim();
  const results = [];

  for (const provider of providers) {
    const evidence = [];
    let score = 0;
    const domains = Array.isArray(provider.official_domains) ? provider.official_domains : [];
    const normalizedDomains = domains.map(normalizeDomain).filter(Boolean);
    const names = [provider.display_name, provider.legal_name].filter(hasValue).map(normalize);

    if (merchant && names.some((name) => name === merchant)) {
      score += 60;
      evidence.push({ type: "merchant_name_exact", strength: "strong", detail: "Le nom du marchand correspond exactement au référentiel." });
    } else if (merchant && names.some((name) => name.includes(merchant) || merchant.includes(name))) {
      score += 25;
      evidence.push({ type: "merchant_name_partial", strength: "medium", detail: "Le nom du marchand présente une correspondance partielle." });
    }

    if (domain && normalizedDomains.includes(domain)) {
      score += 80;
      evidence.push({ type: "official_domain_match", strength: "strong", detail: "Le domaine fourni correspond à un domaine officiel du référentiel." });
    }

    if (reference) {
      for (const item of (Array.isArray(provider.identifier_patterns) ? provider.identifier_patterns : [])) {
        if (!item || !item.pattern) continue;
        try {
          const pattern = new RegExp(item.pattern, item.flags || "");
          if (pattern.test(reference)) {
            score += 5;
            evidence.push({
              type: "reference_format_hint",
              strength: "weak",
              detail: `Le format de la référence correspond à un indice faible : ${String(item.description || "format de référence")}.`
            });
            break;
          }
        } catch {
          // Invalid patterns in a registry must not crash the user request.
        }
      }
    }

    const officialUrls = [
      ...(Array.isArray(provider.official_claim_urls) ? provider.official_claim_urls : []),
      ...(Array.isArray(provider.official_support_urls) ? provider.official_support_urls : [])
    ].filter((url) => safeOfficialUrl(url, domains));

    if (score > 0) {
      results.push({
        provider_id: provider.provider_id,
        display_name: provider.display_name,
        score,
        evidence,
        official_urls: [...new Set(officialUrls)],
        source_urls: (Array.isArray(provider.source_urls) ? provider.source_urls : []).filter(safeHttpsUrl),
        checked_at: provider.checked_at || null
      });
    }
  }

  results.sort((a, b) => b.score - a.score || String(a.display_name).localeCompare(String(b.display_name), "fr"));
  const candidates = results.slice(0, 3);
  const top = candidates[0];
  const hasStrongEvidence = top?.evidence.some((item) => item.strength === "strong") || false;
  const separated = top && (!candidates[1] || top.score - candidates[1].score >= 20);
  let confidence = "low";
  if (top && hasStrongEvidence && top.score >= 60 && separated) confidence = "high";
  else if (top && top.score >= 25) confidence = "medium";

  const needsClarification = confidence !== "high" || candidates.length > 1;
  const reasons = top?.evidence ?? [];
  return {
    status: candidates.length === 0 ? "not_identified" : "candidates_found",
    confidence,
    needs_clarification: needsClarification,
    candidates,
    missing_information: [
      ...(!merchant ? ["merchant"] : []),
      ...(!domain ? ["merchant_domain"] : []),
      ...(!reference ? ["order_number_or_invoice_number"] : [])
    ],
    explanation: candidates.length === 0
      ? "Aucun fournisseur n'a pu être identifié à partir des informations disponibles. Le format d'un numéro seul ne suffit pas."
      : confidence === "high"
        ? "Un candidat ressort grâce à un indice fort. Confirmez le fournisseur avant de préparer une démarche."
        : "Les indices ne suffisent pas à confirmer le fournisseur. Vérifiez les candidats et fournissez un nom de marchand ou un domaine officiel.",
    top_evidence: reasons,
    external_action_allowed: false
  };
}

export function validateProviderRecord(provider) {
  const errors = [];
  if (!provider || !hasValue(provider.provider_id)) errors.push("provider_id requis");
  if (!provider || !hasValue(provider.display_name)) errors.push("display_name requis");
  const domains = Array.isArray(provider?.official_domains) ? provider.official_domains : [];
  if (domains.length === 0 || domains.some((domain) => !normalizeDomain(domain))) {
    errors.push("official_domains doit contenir au moins un domaine valide");
  }
  const urls = [
    ...(Array.isArray(provider?.official_claim_urls) ? provider.official_claim_urls : []),
    ...(Array.isArray(provider?.official_support_urls) ? provider.official_support_urls : [])
  ];
  if (urls.some((url) => !safeOfficialUrl(url, domains))) {
    errors.push("Les URL d'aide/réclamation doivent être HTTPS et appartenir à un domaine officiel déclaré");
  }
  const sources = Array.isArray(provider?.source_urls) ? provider.source_urls : [];
  if (sources.some((url) => !safeHttpsUrl(url))) {
    errors.push("Les URL de sources doivent utiliser HTTPS");
  }
  if (provider?.identifier_patterns && !Array.isArray(provider.identifier_patterns)) {
    errors.push("identifier_patterns doit être un tableau");
  }
  return { valid: errors.length === 0, errors };
}
