import {getStore} from "@netlify/blobs";
import {getSession} from "./auth.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default async req=>{try{
 const s=await getSession(req);if(!s)return out({error:"Connexion requise."},401);
 const e=String(s.email||"").trim().toLowerCase();if(!e)return out({error:"Session invalide."},401);
 let pending=0,approved=0,paid=0,transactions=[];
 for await(const page of store.list({prefix:"transaction/",paginate:true})){for(const b of page.blobs){const tx=await store.get(b.key,{type:"json",consistency:"strong"});if(!tx||String(tx.email||"").toLowerCase()!==e)continue;const a=money(tx.cashbackAmount);if(tx.status==="PENDING")pending=money(pending+a);else if(tx.status==="APPROVED")approved=money(approved+a);else if(tx.status==="PAID")paid=money(paid+a);transactions.push(tx)}}
 transactions.sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")));
 const minimumPayout=Number(process.env.RECUPERE_MIN_PAYOUT||10);
 return out({email:e,pending,approved,payable:approved,paid,minimumPayout,payoutEligible:approved>=minimumPayout,labels:{pending:"En attente",approved:"Validé",payable:"Payable",paid:"Payé"},transactions:transactions.slice(0,20).map(x=>({transactionId:x.transactionId,status:x.status,cashbackAmount:x.cashbackAmount,currency:x.currency,merchant:x.merchant,updatedAt:x.updatedAt}))});
}catch(e){return out({error:"Portefeuille indisponible."},500)}};
export const config={path:"/api/cashback-wallet"};