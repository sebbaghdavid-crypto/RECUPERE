import { getStore } from "@netlify/blobs";
import { analyzeCase } from "./analysis.mjs";
import { buildClaim } from "./claim.mjs";

const store = getStore({ name: "recupere-cases", region: "eu-central-1" });
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function response(body, status=200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function clean(value, max=4000) {
  return String(value ?? "").trim().slice(0, max);
}

function adminOk(req) {
  const expected = process.env.RECUPERE_ADMIN_KEY;
  const provided = req.headers.get("x-admin-key");
  return Boolean(expected && provided && provided === expected);
}

async function getCase(token) {
  if (!token || !/^[a-zA-Z0-9_-]{20,100}$/.test(token)) return null;
  return await store.get(`case/${token}`, { type: "json", consistency: "strong" });
}

async function listCases() {
  const out = [];
  for await (const page of store.list({ prefix: "case/", paginate: true })) {
    for (const item of page.blobs) {
      const token = item.key.slice(5);
      const data = await getCase(token);
      if (data) out.push(data);
    }
  }
  return out.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (token) {
        const item = await getCase(token);
        if (!item) return response({ error: "Dossier introuvable." }, 404);
        const { accessToken, ...safe } = item;
        return response(safe);
      }

      if (url.searchParams.get("admin") === "1") {
        if (!adminOk(req)) return response({ error: "Accès administrateur refusé." }, 401);
        return response({ cases: await listCases() });
      }

      return response({ service: "RECUPERE", status: "ok" });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return response({ error: "Requête invalide." }, 400);
      if (clean(body["bot-field"], 100)) return response({ error: "Requête refusée." }, 400);

      if (body.action === "prepare_claim") {
        if (!adminOk(req)) return response({ error: "Accès administrateur refusé." }, 401);
        const item = await getCase(clean(body.accessToken, 100));
        if (!item) return response({ error: "Dossier introuvable." }, 404);
        if (!["PAID","CLAIM_PREPARED","SENT","FOLLOW_UP","RECOVERED","CLOSED"].includes(item.status)) {
          return response({ error: "Le dossier doit être payé avant de préparer la réclamation." }, 409);
        }
        const claim = buildClaim(item);
        item.claim = claim;
        item.status = "CLAIM_PREPARED";
        item.updatedAt = new Date().toISOString();
        item.events = Array.isArray(item.events) ? item.events : [];
        item.events.push({ at: item.updatedAt, type: "CLAIM_PREPARED" });
        await store.setJSON(`case/${item.accessToken}`, item);
        const { accessToken, ...safe } = item;
        return response(safe);
      }

      if (body.action === "status") {
        if (!adminOk(req)) return response({ error: "Accès administrateur refusé." }, 401);
        const item = await getCase(clean(body.accessToken, 100));
        if (!item) return response({ error: "Dossier introuvable." }, 404);
        const allowed = ["NEW","ANALYSIS","OPPORTUNITY","PAYMENT_REQUIRED","PAID","CLAIM_PREPARED","SENT","FOLLOW_UP","RECOVERED","CLOSED","NO_OPPORTUNITY","INCOMPLETE","REFUNDED","CANCELLED"];
        const status = clean(body.status, 40);
        if (!allowed.includes(status)) return response({ error: "Statut invalide." }, 400);
        item.status = status;
        item.updatedAt = new Date().toISOString();
        item.events = Array.isArray(item.events) ? item.events : [];
        item.events.push({
          at: item.updatedAt,
          type: "STATUS_CHANGED",
          status,
          note: clean(body.note, 2000)
        });
        await store.setJSON(`case/${item.accessToken}`, item);
        const { accessToken, ...safe } = item;
        return response(safe);
      }

      const email = clean(body.email, 254).toLowerCase();
      const name = clean(body.name, 120);
      if (!name || !email || !email.includes("@")) return response({ error: "Nom et email obligatoires." }, 400);

      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().slice(0,8);
      const caseNumber = `REC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
      const now = new Date().toISOString();

      const base = {
        caseNumber,
        accessToken: token,
        name,
        email,
        category: clean(body.category, 120),
        amount: clean(body.amount, 40),
        company: clean(body.company, 180),
        reference: clean(body.reference, 180),
        description: clean(body.description, 6000),
        status: "NEW",
        opportunityLevel: "PENDING",
        estimatedRecovery: null,
        confidence: null,
        createdAt: now,
        updatedAt: now,
        events: [{ at: now, type: "CASE_CREATED" }]
      };
      const analysis = analyzeCase(base);
      const item = {
        ...base,
        status: analysis.opportunityLevel === "STRONG" ? "PAYMENT_REQUIRED" : "ANALYSIS",
        opportunityLevel: analysis.opportunityLevel,
        estimatedRecovery: analysis.estimatedRecovery,
        confidence: analysis.confidence,
        analysisCode: analysis.analysisCode,
        analysisLabel: analysis.analysisLabel,
        analysisSummary: analysis.analysisSummary,
        analysisChecks: analysis.checks,
        analysisSources: analysis.sources,
        analyzedAt: now,
        events: [
          ...base.events,
          { at: now, type: "ANALYSIS_COMPLETED", code: analysis.analysisCode, opportunityLevel: analysis.opportunityLevel, estimatedRecovery: analysis.estimatedRecovery, confidence: analysis.confidence }
        ]
      };
      await store.setJSON(`case/${token}`, item);
      return response({ ok: true, caseNumber, accessToken: token, status: item.status, opportunityLevel: item.opportunityLevel, estimatedRecovery: item.estimatedRecovery, confidence: item.confidence, analysisLabel: item.analysisLabel }, 201);
    }

    return response({ error: "Méthode non supportée." }, 405);
  } catch (error) {
    console.error("RECUPERE cases error", error);
    return response({ error: "Erreur serveur. Le dossier n'a pas pu être traité." }, 500);
  }
};

export const config = {
  path: "/api/cases"
};
