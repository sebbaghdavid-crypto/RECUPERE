import {getStore} from "@netlify/blobs";
import crypto from "node:crypto";
import {allowCashbackWebhookRequest} from "./auth.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
function safeEqual(a,b){const aa=Buffer.from(a||"","utf8"),bb=Buffer.from(b||"","utf8");return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
async function body(req){const ct=req.headers.get("content-type")||"";if(ct.includes("application/json"))return await req.json();const f=await req.formData();const raw=f.get("AwinTransactionPush");if(raw)try{return JSON.parse(raw)}catch{};const o={};for(const [k,v] of f.entries())o[k]=v;return o}
export default async req=>{try{
 const ip=req.headers.get("x-nf-client-connection-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 if(!(await allowCashbackWebhookRequest(ip)))return out({ok:false,error:"Too many requests"},429);
 const expected=process.env.RECUPERE_CASHBACK_WEBHOOK_SECRET;
 if(!expected)return out({ok:false,error:"Webhook non configuré."},503);
 const supplied=req.headers.get("x-recupere-webhook-secret")||req.headers.get("x-recupere-signature")||"";
 if(!safeEqual(supplied,expected))return out({ok:false,error:"Unauthorized"},401);
 const b=await body(req),tx=String(b.transactionId||b.transactionID||""),click=String(b.clickRef||"");
 if(!tx||!click)return out({ok:false,error:"transactionId/clickRef manquant"},400);
 const key="transaction/"+tx,existing=await store.get(key,{type:"json",consistency:"strong"});
 if(existing)return out({ok:true,duplicate:true});
 const clickItem=await store.get("click/"+click,{type:"json",consistency:"strong"});
 if(!clickItem)return out({ok:true,unmatched:true});
 const commission=Math.max(0,money(b.commission)),share=Math.min(100,Math.max(0,Number(process.env.RECUPERE_CASHBACK_SHARE||80))),cashback=money(commission*share/100);
 const item={transactionId:tx,clickref:click,offerId:clickItem.offerId,merchant:clickItem.merchant,email:clickItem.email,transactionAmount:Math.max(0,money(b.transactionAmount)),commission,cashbackRate:share,cashbackAmount:cashback,currency:String(b.transactionCurrency||"EUR").toUpperCase(),status:"PENDING",createdAt:new Date().toISOString(),source:"AWIN"};
 const created=await store.setJSON(key,item,{onlyIfNew:true});
 if(!created.modified)return out({ok:true,duplicate:true});
 return out({ok:true,transactionId:tx,status:"PENDING",cashbackAmount:cashback},201);
}catch(e){console.error("cashback webhook",e);return out({ok:false,error:"Webhook error"},500)}};
export const config={path:"/api/cashback-webhook"};