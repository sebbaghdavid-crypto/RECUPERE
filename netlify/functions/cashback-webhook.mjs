import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json"}});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
async function body(req){const ct=req.headers.get("content-type")||"";if(ct.includes("application/json"))return await req.json();const f=await req.formData();const raw=f.get("AwinTransactionPush");if(raw)try{return JSON.parse(raw)}catch{};const o={};for(const [k,v] of f.entries())o[k]=v;return o}
export default async req=>{try{
 const expected=process.env.RECUPERE_CASHBACK_WEBHOOK_SECRET;
 if(expected){const supplied=req.headers.get("x-recupere-webhook-secret")||req.headers.get("x-recupere-signature")||""; if(supplied!==expected)return out({ok:false,error:"Unauthorized"},401);}
 const b=await body(req);const tx=String(b.transactionId||b.transactionID||"");const click=String(b.clickRef||"");if(!tx||!click)return out({ok:false,error:"transactionId/clickRef manquant"},400);
 const existing=await store.get("transaction/"+tx,{type:"json",consistency:"strong"});if(existing)return out({ok:true,duplicate:true});
 const clickItem=await store.get("click/"+click,{type:"json",consistency:"strong"});if(!clickItem)return out({ok:true,unmatched:true});
 const commission=money(b.commission);const share=Math.min(100,Math.max(0,Number(process.env.RECUPERE_CASHBACK_SHARE||80)));const cashback=money(commission*share/100);
 const item={transactionId:tx,clickref:click,offerId:clickItem.offerId,merchant:clickItem.merchant,email:clickItem.email,transactionAmount:money(b.transactionAmount),commission,cashbackRate:share,cashbackAmount:cashback,currency:String(b.transactionCurrency||"EUR"),status:"PENDING",createdAt:new Date().toISOString(),source:"AWIN"};
 await store.setJSON("transaction/"+tx,item);
 if(clickItem.email){const key="wallet/"+clickItem.email.replace(/[^a-z0-9@._-]/gi,"_");const w=await store.get(key,{type:"json",consistency:"strong"})||{email:clickItem.email,pending:0,approved:0,paid:0,transactions:[]};w.pending=money(w.pending+cashback);w.transactions=[...(w.transactions||[]),tx].slice(-100);w.updatedAt=new Date().toISOString();await store.setJSON(key,w)}
 return out({ok:true,transactionId:tx,status:"PENDING",cashbackAmount:cashback},201);
}catch(e){console.error("cashback webhook",e);return out({ok:false,error:"Webhook error"},500)}};
export const config={path:"/api/cashback-webhook"};