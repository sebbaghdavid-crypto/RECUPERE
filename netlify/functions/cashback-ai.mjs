import { getStore } from "@netlify/blobs";

const store = getStore({ name: "recupere-cashback", region: "eu-central-1" });
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const out = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (v, n = 300) => String(v ?? "").trim().slice(0, n);

async function offers() {
  const raw = process.env.RECUPERE_CASHBACK_OFFERS;
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(o => o && o.active !== false) : [];
  } catch {
    return [];
  }
}

function score(offer, q) {
  const text = [
    offer.merchant, offer.category, offer.description, offer.keywords,
    offer.tags, q
  ].join(" ").toLowerCase();
  const words = q.toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter(w => w.length > 2);
  let s = 0;
  for (const w of words) if (text.includes(w)) s += 10;
  if (offer.cashbackRate != null) s += Math.min(Number(offer.cashbackRate) || 0, 20);
  if (offer.active !== false) s += 2;
  return s;
}

async function remember(email, query, resultIds) {
  if (!email) return;
  const key = "ai-search/" + crypto.randomUUID();
  await store.setJSON(key, {
    email: clean(email, 254).toLowerCase(),
    query: clean(query),
    resultIds,
    createdAt: new Date().toISOString()
  });
}

export default async req => {
  try {
    if (req.method !== "POST") return out({ error: "POST requis." }, 405);
    const body = await req.json().catch(() => ({}));
    const query = clean(body.query);
    if (!query) return out({ error: "Décris ce que tu veux acheter." }, 400);

    const all = await offers();
    const ranked = all
      .map(o => ({ ...o, aiScore: score(o, query) }))
      .filter(o => o.aiScore > 2)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 12);

    await remember(body.email, query, ranked.map(o => o.id));
    return out({
      ok: true,
      engine: "RECUPERE-SMART-CASHBACK-V1",
      query,
      results: ranked.map(({ aiScore, ...o }) => ({
        ...o,
        recommendation: aiScore >= 20 ? "Très pertinent" : "Pertinent"
      }))
    });
  } catch (e) {
    console.error("cashback-ai", e);
    return out({ error: "Moteur cashback indisponible." }, 500);
  }
};

export const config = { path: "/api/cashback-ai" };
