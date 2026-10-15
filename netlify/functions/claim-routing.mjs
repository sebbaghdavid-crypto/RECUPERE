import { getSession, allowClaimRoutingRequest } from "./auth.mjs";
import { hasConsent } from "./consent.mjs";
import { identifyProviders, validateProviderRecord } from "../../src/claim-routing/engine.mjs";
import registry from "../../src/claim-routing/registry.json" with { type: "json" };

const MAX_BODY_BYTES = 16_384;
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function ipFor(req) {
  return req.headers.get("x-nf-client-connection-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

const validatedProviders = (Array.isArray(registry.providers) ? registry.providers : [])
  .map((provider) => ({ provider, validation: validateProviderRecord(provider) }))
  .filter(({ validation }) => validation.valid)
  .map(({ provider }) => provider);

export default async function handler(req) {
  if (req.method !== "POST") {
    return response({ error: "Méthode non supportée." }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return response({ error: "Requête trop volumineuse." }, 413);
  }

  try {
    const session = await getSession(req);
    if (!session?.email) {
      return response({ error: "Connexion requise pour analyser ces informations." }, 401);
    }

    // Check the actual body size as well; Content-Length may be absent.
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return response({ error: "Requête trop volumineuse." }, 413);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return response({ error: "Requête JSON invalide." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Requête JSON invalide." }, 400);
    }
    if (!hasConsent(body.consent)) {
      return response({ error: "Veuillez confirmer votre accord avant l'analyse." }, 400);
    }

    // Deliberately do not persist the supplied references or document contents.
    // Uploads/OCR and external web search remain out of scope for this endpoint.
    const input = {
      merchant: clean(body.merchant, 180),
      merchant_domain: clean(body.merchant_domain, 253),
      email_domain: clean(body.email_domain, 253),
      order_number: clean(body.order_number, 180),
      invoice_number: clean(body.invoice_number, 180),
      reference: clean(body.reference, 180)
    };

    if (![input.merchant, input.merchant_domain, input.email_domain, input.order_number, input.invoice_number, input.reference].some(Boolean)) {
      return response({ error: "Indiquez au moins un indice : marchand, domaine ou référence." }, 400);
    }

    // Invalid requests do not consume the analysis quota.
    if (!(await allowClaimRoutingRequest(session.email, ipFor(req)))) {
      return response({ error: "Trop d'analyses. Réessayez dans une minute." }, 429);
    }

    const result = identifyProviders(input, validatedProviders);
    return response({
      ok: true,
      result,
      notice: "Résultat indicatif basé sur le référentiel interne versionné. Vérifiez les sources et confirmez le fournisseur avant toute démarche.",
      external_action_performed: false,
      persisted: false
    });
  } catch (error) {
    // Do not log user-supplied order numbers, invoice numbers, or request bodies.
    console.error("RECUPERE claim-routing error", error?.name || "UnknownError");
    return response({ error: "Analyse indisponible pour le moment." }, 500);
  }
}

export const config = {
  path: "/api/claim-routing"
};