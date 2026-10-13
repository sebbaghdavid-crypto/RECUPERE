import {getStore} from "@netlify/blobs";
import {getSession} from "./auth.mjs";
import {dedupeRecords,summarizeWallet} from "./cashback-wallet-ledger.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default async req=>{try{
 const s=await getSession(req);if(!s)return out({error:"Connexion requise."},401);
 const e=String(s.email||"").trim().toLowerCase();if(!e)return out({error:"Session invalide."},401);
 const records=[];
 for await(const page of store.list({prefix:"transaction/",paginate:true})){
  for(const b of page.blobs){
   const tx=await store.get(b.key,{type:"json",consistency:"strong"});
   if(tx&&String(tx.email||"").trim().toLowerCase()===e)records.push({key:b.key,tx});
  }
 }
 const summary=summarizeWallet(dedupeRecords(records),process.env.RECUPERE_MIN_PAYOUT||10);
 return out({
  email:e,...summary,
  labels:{pending:"En attente",approved:"Validé par le marchand",payable:"Éligible au paiement",paid:"Payé"},
  note:"Le solde payable est un calcul d'éligibilité. Aucun virement n'est déclenché par cette API."
 });
}catch(e){console.error("cashback wallet error",e);return out({error:"Portefeuille indisponible."},500)}};
export const config={path:"/api/cashback-wallet"};
