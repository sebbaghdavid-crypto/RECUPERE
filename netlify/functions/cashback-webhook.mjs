import {getStore} from "@netlify/blobs";
import crypto from "node:crypto";
import {allowCashbackWebhookRequest} from "./auth.mjs";
import {cashbackShare} from "./cashback-ledger.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
function safeEqual(a,b){const aa=Buffer.from(a||"","utf8"),bb=Buffer.from(b||"","utf8");return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
async function body(req){const ct=req.headers.get("content-type")||"";if(ct.includes("application/json"))return await req.json();const f=await req.formData();const raw=f.get("AwinTransactionPush");if(raw)try{return JSON.parse(raw)}catch{};const o={};for(const [k,v] of f.entries())o[k]=v;return o}
export default async req=>{try{
 // Fail closed until an AWIN-compatible authenticated gateway has been configured and verified.
 if(process.env.RECUPERE_AWIN_WEBHOOK_ENABLED!=="true")return out({ok:false,error:"Webhook AWIN désactivé en attente de validation de l'authentification."},503);
 const expected=process.env.RECUPERE_CASHBACK_WEBHOOK_SECRET;
 if(!expected)return out({ok:false,error:"Webhook non configuré."},503);
 const ip=req.headers.get("x-nf-client-connection-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 if(!(await allowCashbackWebhookRequest(ip)))return out({ok:false,error:"Too many requests"},429);
 // Accept only the dedicated shared-secret header. Do not mistake a provider signature for a raw secret.
 const supplied=req.headers.get("x-recupere-webhook-secret")||"";
 if(!safeEqual(supplied,expected))return out({ok:false,error:"Unauthorized"},401);
 const b=await body(req),tx=String(b.transactionId||b.transactionID||""),click=String(b.clickRef||"");
 if(!tx||!click)return out({ok:false,error:"transactionId/clickRef manquant"},400);
 const commission=money(b.commission);
 const currency=String(b.transactionCurrency||"UNKNOWN").trim().toUpperCase();
 if(!Number.isFinite(Number(b.commission))||commission<0)return out({ok:false,error:"Commission invalide"},400);
 if(!currency||currency==="UNKNOWN")return out({ok:false,error:"Devise absente"},400);
 const key="transaction/awin/"+tx;
 const existing=await store.get(key,{type:"json",consistency:"strong"});
 if(existing)return out({ok:true,duplicate:true});
 const clickItem=await store.get("click/"+click,{type:"json",consistency:"strong"});
 if(!clickItem)return out({ok:true,unmatched:true});
 const share=cashbackShare(process.env.RECUPERE_CASHBACK_SHARE??80);
 const cashback=money(commission*share/100);
 const item={
  transactionId:tx,clickref:click,offerId:clickItem.offerId,merchant:clickItem.merchant,email:clickItem.email,
  transactionAmount:Math.max(0,money(b.transactionAmount)),commission,cashbackRate:share,cashbackAmount:cashback,
  currency,status:"PENDING",providerStatus:"PENDING",payoutStatus:"NOT_PAID",payoutEligible:false,
  createdAt:new Date().toISOString(),source:"AWIN"
 };
 const created=await store.setJSON(key,item,{onlyIfNew:true});
 if(!created.modified)return out({ok:true,duplicate:true});
 return out({ok:true,transactionId:tx,status:"PENDING",cashbackAmount:cashback},201);
}catch(e){console.error("cashback webhook",e);return out({ok:false,error:"Webhook error"},500)}};
export const config={path:"/api/cashback-webhook"};
