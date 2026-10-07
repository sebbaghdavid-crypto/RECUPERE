import { getStore } from "@netlify/blobs";
import { allowPaymentRequest, getSession } from "./auth.mjs";

const store = getStore({ name: "recupere-cases", region: "eu-central-1" });
const PRICE_ID = process.env.RECUPERE_STRIPE_PRICE_ID || "price_1UNs7PRS9BxXjI4TydRc7JIX";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const BASE_URL = process.env.RECUPERE_BASE_URL || "https://jade-pegasus-f6e204.netlify.app";

function response(body, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function clean(value, max=4000) { return String(value ?? "").trim().slice(0, max); }
async function getCase(token) {
  if (!token || !/^[a-zA-Z0-9_-]{20,100}$/.test(token)) return null;
  return await store.get(`case/${token}`, { type: "json", consistency: "strong" });
}

export default async (req) => {
  try {
    if (req.method !== "POST") return response({ error: "Méthode non supportée." }, 405);
    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await allowPaymentRequest(ip))) return response({ error: "Trop de demandes. Réessayez plus tard." }, 429);
    if (!STRIPE_SECRET_KEY) return response({ error: "Paiement momentanément indisponible." }, 503);

    const body = await req.json().catch(() => null);
    const caseNumber = clean(body?.caseNumber, 80);
    const session = await getSession(req);
    if (!session?.email || !caseNumber) return response({ error: "Connexion requise." }, 401);
    let item = null;
    for await (const page of store.list({ prefix: "case/", paginate: true })) {
      for (const blob of page.blobs) {
        const candidate = await store.get(blob.key, { type: "json", consistency: "strong" });
        if (candidate?.caseNumber === caseNumber) { item = candidate; break; }
      }
      if (item) break;
    }
    if (item && String(item.email).toLowerCase() !== String(session.email).toLowerCase()) return response({ error: "Dossier introuvable ou accès refusé." }, 404);
    if (!item) return response({ error: "Dossier introuvable ou accès refusé." }, 404);
    if (item.payment?.status === "paid" || item.status === "PAID") {
      return response({ ok: true, alreadyPaid: true, caseNumber: item.caseNumber });
    }
    if (item.payment?.checkoutSessionId && item.payment?.status === "pending" && item.payment?.checkoutUrl) {
      return response({ ok: true, checkoutUrl: item.payment.checkoutUrl, caseNumber: item.caseNumber, reusedCheckout: true });
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("line_items[0][price]", PRICE_ID);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${BASE_URL}/?payment=success&case=${encodeURIComponent(item.caseNumber)}#suivi`);
    params.set("cancel_url", `${BASE_URL}/?payment=cancelled&case=${encodeURIComponent(item.caseNumber)}#suivi`);
    params.set("customer_creation", "always");
    params.set("customer_email", item.email);
    params.set("billing_address_collection", "auto");
    params.set("invoice_creation[enabled]", "true");
    params.set("metadata[case_number]", item.caseNumber);
    params.set("metadata[case_token]", item.accessToken);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `recupere-checkout-${item.accessToken}`
      },
      body: params
    });
    const stripeSession = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error("Stripe Checkout error", session);
      return response({ error: "Impossible de créer le paiement." }, 502);
    }

    const now = new Date().toISOString();
    item.status = "PAYMENT_REQUIRED";
    item.payment = {
      provider: "stripe",
      checkoutSessionId: stripeSession.id,
      checkoutUrl: stripeSession.url,
      paymentStatus: "pending",
      status: "pending",
      amount: 990,
      currency: "eur",
      createdAt: now
    };
    item.updatedAt = now;
    item.events = Array.isArray(item.events) ? item.events : [];
    item.events.push({ at: now, type: "PAYMENT_CHECKOUT_CREATED", provider: "stripe", amount: 9.90 });
    await store.setJSON(`case/${item.accessToken}`, item);

    return response({ ok: true, checkoutUrl: stripeSession.url, caseNumber: item.caseNumber });
  } catch (error) {
    console.error("RECUPERE payment error", error);
    return response({ error: "Erreur serveur pendant la préparation du paiement." }, 500);
  }
};

export const config = { path: "/api/payment" };
