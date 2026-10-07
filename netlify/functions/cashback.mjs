import { getStore } from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=500)=>String(v??"").trim().slice(0,n);
const fallback=[{id:"partner-coming-soon",merchant:"RÉSEAU PARTENAIRE",category:"Shopping",cashbackRate:null,description:"Le taux réel apparaîtra dès qu'un programme cashback partenaire est activé.",destinationUrl:"https://www.awin.com/",active:true}];
async function offers(){const raw=process.env.RECUPERE_CASHBACK_OFFERS;if(raw){try{const x=JSON.parse(raw);if(Array.isArray(x))return x.filter(o=>o&&o.active!==false)}catch{}}return fallback}
async function link(o,clickref){
 if(o.trackingUrlTemplate)return o.trackingUrlTemplate.replace("{clickref}",encodeURIComponent(clickref));
 if(!(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID&&o.advertiserId))return o.destinationUrl;
 const r=await fetch("https://api.awin.com/publishers/"+process.env.AWIN_PUBLISHER_ID+"/linkbuilder/generate",{method:"POST",headers:{Authorization:"Bearer "+process.env.AWIN_API_TOKEN,"content-type":"application/json"},body:JSON.stringify({advertiserId:Number(o.advertiserId),destinationUrl:o.destinationUrl,parameters:{clickref}})});
 if(!r.ok)throw Error("AWIN_LINK_ERROR"); const d=await r.json(); return d.url||o.destinationUrl;
}
export default async req=>{try{
 const u=new URL(req.url);
 if(req.method==="GET"){const os=await offers();return out({ok:true,trackingConfigured:Boolean(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID),offers:os.map(o=>({...o,trackingReady:Boolean(o.trackingUrlTemplate||(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID&&o.advertiserId))}))})}
 if(req.method==="POST"){const b=await req.json().catch(()=>null);if(!b||b.action!=="click")return out({error:"Action invalide."},400);const o=(await offers()).find(x=>String(x.id)===clean(b.offerId,100));if(!o)return out({error:"Offre introuvable."},404);const clickref="rcp_"+crypto.randomUUID().replaceAll("-","").slice(0,24);const trackingUrl=await link(o,clickref);await store.setJSON("click/"+clickref,{clickref,offerId:o.id,merchant:o.merchant,email:clean(b.email,254).toLowerCase(),createdAt:new Date().toISOString(),status:"CLICKED"});return out({ok:true,clickref,trackingUrl},201)}
 return out({error:"Méthode non supportée."},405);
}catch(e){console.error(e);return out({error:"Service cashback indisponible."},500)}};
export const config={path:"/api/cashback"};