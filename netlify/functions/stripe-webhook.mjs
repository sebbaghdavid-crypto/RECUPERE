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
 const parts=header.split(",").map(x=>x.trim().split("=")).filter(x=>x.length===2);
 const timestamp=parts.find(([key])=>key==="t")?.[1];
 const signatures=parts.filter(([key])=>key==="v1").map(([,value])=>value);
 if(!timestamp||!signatures.length)return false;
 const age=Math.abs(Date.now()/1000-Number(timestamp));if(!Number.isFinite(age)||age>300)return false;
 const expected=crypto.createHmac("sha256",WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex");
 return signatures.some(signature=>safeEqual(expected,signature));
}
export function checkoutSessionDisposition(payment,sessionId){if(!payment?.checkoutSessionId)return "retry";return payment.checkoutSessionId===sessionId?"match":"stale"}
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
export default async req=>{
 let claimedEventId="";
 try{
  if(req.method!=="POST")return response({error:"Méthode non supportée."},405);
  const rawBody=await req.text();if(!verifySignature(rawBody,req.headers.get("stripe-signature")))return response({error:"Signature Stripe invalide."},400);
  const event=JSON.parse(rawBody),eventId=String(event.id||"");
  const session=event.data?.object,token=session?.metadata?.case_token;
  if(!token)return response({received:true});
  if(!await claimEvent(eventId))return response({received:true,duplicate:true});
  claimedEventId=eventId;
  const item=await getCase(token);
  if(!item){await finishEvent(eventId);return response({received:true});}
  if((event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded")&&session.payment_status==="paid"){
   const disposition=checkoutSessionDisposition(item.payment,session.id);if(disposition==="retry"){await releaseEvent(eventId);return response({error:"Checkout session not yet linked; retry."},500)}if(disposition==="stale"){await finishEvent(eventId);return response({received:true,ignored:"unmatched_checkout_session"})}
   const paidAmount=Number(session.amount_total),paidCurrency=String(session.currency||"").toLowerCase();
   if(paidAmount!==990||paidCurrency!=="eur"){await releaseEvent(eventId);return response({error:"Paiement invalide."},400)}
   const paidAt=new Date().toISOString();
   const result=await updateCase(token,current=>{
    if(current.payment?.checkoutSessionId!==session.id)return null;
    if(current.status==="PAID"&&current.payment?.status==="paid")return current;
    current.status="PAID";
    current.payment={...(current.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"paid",status:"paid",paidAt,customerId:session.customer||null,invoiceId:session.invoice||null};
    current.events=Array.isArray(current.events)?current.events:[];
    if(!current.events.some(e=>e.type==="PAYMENT_CONFIRMED"&&e.checkoutSessionId===session.id))current.events.push({at:paidAt,type:"PAYMENT_CONFIRMED",provider:"stripe",checkoutSessionId:session.id,amount:9.90,eventId});
    return current;
   });
   if(!result.ok){
    const latest=await getCase(token);
    if(!latest||latest.payment?.checkoutSessionId!==session.id){await finishEvent(eventId);return response({received:true,ignored:"unmatched_checkout_session"})}
    await releaseEvent(eventId);return response({error:"Mise à jour du paiement à réessayer."},500);
   }
   const emailResult=await sendCustomerEmail({to:result.item.email,name:result.item.name,caseNumber:result.item.caseNumber,subject:`RÉCUPÈRE — paiement confirmé ${result.item.caseNumber}`,title:"Votre paiement est confirmé",body:"Votre paiement de 9,90 € a été confirmé. Votre dossier peut maintenant passer à la préparation de la réclamation.",idempotencyKey:`payment-confirmed|${session.id}`});
   if(!emailResult?.sent){await releaseEvent(eventId);return response({error:"Paiement enregistré ; notification à réessayer."},500)}
  }else if(event.type==="checkout.session.async_payment_failed"){
   const disposition=checkoutSessionDisposition(item.payment,session.id);if(disposition==="retry"){await releaseEvent(eventId);return response({error:"Checkout session not yet linked; retry."},500)}if(disposition==="stale"){await finishEvent(eventId);return response({received:true,ignored:"stale_checkout_session"})}
   const result=await updateCase(token,current=>{if(current.payment?.checkoutSessionId!==session.id)return null;if(current.status==="PAID"||current.payment?.status==="paid")return current;current.payment={...(current.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"failed",status:"failed"};current.events=Array.isArray(current.events)?current.events:[];if(!current.events.some(e=>e.type==="PAYMENT_FAILED"&&e.checkoutSessionId===session.id))current.events.push({at:new Date().toISOString(),type:"PAYMENT_FAILED",provider:"stripe",checkoutSessionId:session.id,eventId});return current});if(!result.ok){await releaseEvent(eventId);return response({error:"Mise à jour du paiement à réessayer."},500)}
  }else if(event.type==="checkout.session.expired"){
   if(item.payment?.checkoutSessionId!==session.id){await finishEvent(eventId);return response({received:true,ignored:"stale_checkout_session"})}
   const result=await updateCase(token,current=>{if(current.payment?.checkoutSessionId!==session.id)return null;if(current.status==="PAID"||current.payment?.status==="paid")return current;current.payment={...(current.payment||{}),provider:"stripe",checkoutSessionId:session.id,paymentStatus:"expired",status:"expired"};current.events=Array.isArray(current.events)?current.events:[];if(!current.events.some(e=>e.type==="PAYMENT_EXPIRED"&&e.checkoutSessionId===session.id))current.events.push({at:new Date().toISOString(),type:"PAYMENT_EXPIRED",provider:"stripe",checkoutSessionId:session.id,eventId});return current});if(!result.ok){await releaseEvent(eventId);return response({error:"Mise à jour du paiement à réessayer."},500)}
  }
  await finishEvent(eventId);return response({received:true});
 }catch(error){console.error("RECUPERE stripe webhook error",error);if(claimedEventId){try{await releaseEvent(claimedEventId)}catch(releaseError){console.error("RECUPERE stripe webhook release error",releaseError)}}return response({error:"Erreur temporaire de traitement du webhook."},500)}
};
export const config={path:"/api/stripe-webhook"};