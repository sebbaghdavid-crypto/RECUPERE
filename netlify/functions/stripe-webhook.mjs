import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { sendCustomerEmail } from "./notifications.mjs";
import { updateCase } from "./case-store.mjs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET;
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeEqual(a,b){const aa=Buffer.from(a||"","utf8"),bb=Buffer.from(b||"","utf8");return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function verifySignature(rawBody,header){
 if(!WEBHOOK_SECRET||!header)return false;
 const parts=Object.fromEntries(header.split(",").map(x=>x.split("=")).filter(x=>x.length===2)),timestamp=parts.t,signature=parts.v1;
 if(!timestamp||!signature)return false;
 const age=Math.abs(Date.now()/1000-Number(timestamp));if(!Number.isFinite(age)||age>300)return false;
 return safeEqual(crypto.createHmac("sha256",WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex"),signature);
}
async function getCase(token){if(!token||!/^[a-zA-Z0-9_-]{20,100}$/.test(token))return null;return store.get(`case/${token}`,{type:"json",consistency:"strong"})}
async function claimEvent(eventId){
 if(!eventId||!/^evt_[a-zA-Z0-9_]+$/.test(eventId))return false;
 const key="stripe-event/"+eventId,now=Date.now(),current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});
 if(!current){
  const r=await store.setJSON(key,{status:"processing",claimedAt:now},{onlyIfNew:true});
  return r.modified;
 }
 const data=current.data||{};
 if(data.status==="done")return false;
 if(Number(data.claimedAt)>now-300000)return false;
 const r=await store.setJSON(key,{status:"processing",claimedAt:now},{onlyIfMatch:current.etag});
 return r.modified;
}
async function finishEvent(eventId){if(eventId)await store.setJSON("stripe-event/"+eventId,{status:"done",completedAt:Date.now()})}
async function releaseEvent(eventId){if(eventId)await store.delete("stripe-event/"+eventId)}
async function saveCase(item,event){
 const now=new Date().toISOString();item.updatedAt=now;item.events=Array.isArray(item.events)?item.events:[];
 if(!item.events.some(e=>e.type===event.type&&e.checkoutSessionId===event.checkoutSessionId&&e.eventId===event.eventId))item.events.push({at:now,...event});
 await store.setJSON(`case/${item.accessToken}`,item);return true;
}
export default async req=>{
 try{
  if(req.method!=="POST")return response({error:"Méthode non supportée."},405);
  const rawBody=await req.text();if(!verifySignature(rawBody,req.headers.get("stripe-signature")))return response({error:"Signature Stripe invalide."},400);
  const event=JSON.parse(rawBody),eventId=String(event.id||"");
  const session=event.data?.object,token=session?.metadata?.case_token;
  if(!token)return response({received:true});
  if(!await claimEvent(eventId))return response({received:true,duplicate:true});
  const item=await getCase(token);
  if(!item){await finishEvent(eventId);return response({received:true});}
  if((event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded")&&session.payment_status==="paid"){
   if(item.payment?.checkoutSessionId&&item.payment.checkoutSessionId!==session.id){await finishEvent(eventId);return response({received:true,ignored:"stale_checkout_session"})}
   const paidAmount=Number(session.amount_total),paidCurrency=String(session.currency||"").toLowerCase();
   if(paidAmount!==990||paidCurrency!=="eur"){await finishEvent(eventId);return response({error:"Paiement invalide."},400)}
   item.status="PAID";item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"paid",status:"paid",paidAt:new Date().toISOString(),customerId:session.customer||null,invoiceId:session.invoice||null};
   await saveCase(item,{type:"PAYMENT_CONFIRMED",provider:"stripe",checkoutSessionId:session.id,amount:9.90,eventId});
   if(event.type==="checkout.session.completed")await sendCustomerEmail({to:item.email,name:item.name,caseNumber:item.caseNumber,subject:`RÉCUPÈRE — paiement confirmé ${item.caseNumber}`,title:"Votre paiement est confirmé",body:"Votre paiement de 9,90 € a été confirmé. Votre dossier peut maintenant passer à la préparation de la réclamation.",idempotencyKey:`payment-confirmed|${eventId}`});
  }else if(event.type==="checkout.session.async_payment_failed"){
   if(item.payment?.checkoutSessionId!==session.id){await finishEvent(eventId);return response({received:true,ignored:"stale_checkout_session"})}
   item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"failed",status:"failed"};await saveCase(item,{type:"PAYMENT_FAILED",provider:"stripe",checkoutSessionId:session.id,eventId});
  }else if(event.type==="checkout.session.expired"){
   if(item.payment?.checkoutSessionId!==session.id){await finishEvent(eventId);return response({received:true,ignored:"stale_checkout_session"})}
   item.payment={...(item.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"expired",status:"expired"};await saveCase(item,{type:"PAYMENT_EXPIRED",provider:"stripe",checkoutSessionId:session.id,eventId});
  }
  await finishEvent(eventId);return response({received:true});
 }catch(error){console.error("RECUPERE stripe webhook error",error);return response({error:"Webhook invalide."},400)}
};
export const config={path:"/.netlify/functions/stripe-webhook"};