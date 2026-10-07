import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const store = getStore({ name: "recupere-cases", region: "eu-central-1" });
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function response(body, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function safeEqual(a,b) {
  const aa=Buffer.from(a||"","utf8"), bb=Buffer.from(b||"","utf8");
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function verifySignature(rawBody, header) {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map(x=>x.split("=")).filter(x=>x.length===2));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now()/1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signed).digest("hex");
  return safeEqual(expected, signature);
}
async function getCase(token) {
  if (!token || !/^[a-zA-Z0-9_-]{20,100}$/.test(token)) return null;
  return await store.get(`case/${token}`, { type: "json", consistency: "strong" });
}
async function saveCase(item, event) {
  const now=new Date().toISOString();
  item.updatedAt=now;
  item.events=Array.isArray(item.events)?item.events:[];
  if (!item.events.some(e=>e.type===event.type && e.checkoutSessionId===event.checkoutSessionId)) {
    item.events.push({at:now,...event});
  }
  await store.setJSON(`case/${item.accessToken}`, item);
}

export default async (req) => {
  try {
    if (req.method !== "POST") return response({ error:"Méthode non supportée." },405);
    const rawBody=await req.text();
    if (!verifySignature(rawBody, req.headers.get("stripe-signature"))) {
      return response({ error:"Signature Stripe invalide." },400);
    }
    const event=JSON.parse(rawBody);
    const session=event.data?.object;
    const token=session?.metadata?.case_token;
    if (!token) return response({ received:true });

    const item=await getCase(token);
    if (!item) return response({ received:true });

    if (event.type==="checkout.session.completed" && session.payment_status==="paid") {
      item.status="PAID";
      item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"paid",status:"paid",paidAt:new Date().toISOString(),customerId:session.customer||null,invoiceId:session.invoice||null};
      await saveCase(item,{type:"PAYMENT_CONFIRMED",provider:"stripe",checkoutSessionId:session.id,amount:9.90});
    } else if (event.type==="checkout.session.async_payment_succeeded") {
      item.status="PAID";
      item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"paid",status:"paid",paidAt:new Date().toISOString()};
      await saveCase(item,{type:"PAYMENT_CONFIRMED_ASYNC",provider:"stripe",checkoutSessionId:session.id,amount:9.90});
    } else if (event.type==="checkout.session.async_payment_failed") {
      item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"failed",status:"failed"};
      await saveCase(item,{type:"PAYMENT_FAILED",provider:"stripe",checkoutSessionId:session.id});
    } else if (event.type==="checkout.session.expired") {
      item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"expired",status:"expired"};
      await saveCase(item,{type:"PAYMENT_EXPIRED",provider:"stripe",checkoutSessionId:session.id});
    }
    return response({received:true});
  } catch(error) {
    console.error("RECUPERE stripe webhook error",error);
    return response({error:"Webhook invalide."},400);
  }
};
export const config={path:"/.netlify/functions/stripe-webhook"};
