import {getStore} from "@netlify/blobs";
import {getSession} from "../netlify/functions/auth.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default async req=>{try{
 const s=await getSession(req);if(!s)return out({error:"Connexion requise."},401);
 const e=String(s.email||"").trim().toLowerCase();if(!e)return out({error:"Session invalide."},401);
 const key="wallet/"+e.replace(/[^a-z0-9@._-]/gi,"_");
 const w=await store.get(key,{type:"json",consistency:"strong"})||{email:e,pending:0,approved:0,paid:0,transactions:[]};
 const minimumPayout=Number(process.env.RECUPERE_MIN_PAYOUT||10),pending=Number(w.pending||0),approved=Number(w.approved||0),paid=Number(w.paid||0);
 return out({email:e,pending,approved,payable:approved,paid,minimumPayout,payoutEligible:approved>=minimumPayout,labels:{pending:"En attente",approved:"Validé",payable:"Payable",paid:"Payé"},transactions:(w.transactions||[]).slice(-20)});
}catch(e){return out({error:"Portefeuille indisponible."},500)}};
export const config={path:"/api/cashback-wallet"};