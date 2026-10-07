import { getStore } from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const out=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers});

const providerStatus=()=>({
  catuik:Boolean(process.env.CATUIK_API_KEY),
  capitis:Boolean(process.env.CAPITIS_API_KEY),
  effiliation:Boolean(process.env.EFFILIATION_API_KEY),
  feedico:Boolean(process.env.FEEDICO_API_KEY)
});

async function json(url,opts={}) {
  const r=await fetch(url,opts);
  if(!r.ok) throw Error("PROVIDER_"+r.status);
  return r.json();
}

async function catuik(q) {
  if(!process.env.CATUIK_API_KEY) return [];
  const u=new URL(process.env.CATUIK_API_URL||"https://api.catuik.com/v1/merchants");
  if(q) u.searchParams.set("q",q);
  const d=await json(u,{headers:{Authorization:"Bearer "+process.env.CATUIK_API_KEY}});
  return (d.merchants||d.data||[]).map(x=>({...x,provider:"catuik"}));
}

async function capitis(q) {
  if(!process.env.CAPITIS_API_KEY) return [];
  const base=process.env.CAPITIS_API_URL||"https://api.capitis.app/v1";
  const u=new URL(q ? base+"/merchants/search" : base+"/merchants");
  if(q) u.searchParams.set("q",q);
  u.searchParams.set("limit","100");
  const d=await json(u,{headers:{Authorization:"Bearer "+process.env.CAPITIS_API_KEY}});
  return (d.data||d.merchants||[]).map(x=>({
    id:x.id||x.merchantId,
    merchantId:x.id||x.merchantId,
    name:x.displayName||x.canonicalName||x.name||x.title,
    description:x.description||"",
    website:x.domain ? "https://"+x.domain : (x.website||x.url||""),
    logoUrl:x.logoUrl||"",
    offerCount:Number(x.offerCount||0),
    provider:"capitis",
    active:x.isActive!==false && x.active!==false
  }));
}

async function capitisOffers(merchantId){
  if(!process.env.CAPITIS_API_KEY||!merchantId) return [];
  const base=process.env.CAPITIS_API_URL||"https://api.capitis.app/v1";
  const u=new URL(base+"/merchants/"+encodeURIComponent(merchantId)+"/offers");
  u.searchParams.set("limit","100");
  const d=await json(u,{headers:{Authorization:"Bearer "+process.env.CAPITIS_API_KEY}});
  const offers=(d.data||d.offers||[]).filter(x=>x.isActive!==false).map(x=>({
    id:x.id, merchantId:x.merchantId||merchantId, merchant:x.merchantName,
    title:x.title||x.brand||"Offre", description:x.description||"",
    type:x.type||"product", deeplinkUrl:x.deeplinkUrl||"", trackingUrl:x.trackingUrl||"",
    commissionType:x.commissionType||null, commissionValue:x.commissionValue||null,
    commissionCurrency:x.commissionCurrency||null, startsAt:x.startsAt||null,
    expiresAt:x.expiresAt||null, exclusive:Boolean(x.isExclusive),
    priceAmount:x.priceAmount||null, priceCurrency:x.priceCurrency||null,
    imageUrl:x.imageUrl||"", provider:"capitis", active:true
  }));
  for(const offer of offers){if(offer.id)await store.setJSON("offer/"+String(offer.id),offer)}
  return offers;
}

async function feedico(q) {
  if(!process.env.FEEDICO_API_KEY) return [];
  const u=new URL(process.env.FEEDICO_API_URL||"https://api.feedico.io/api/v1/me/merchants");
  if(q) u.searchParams.set("q",q);
  const d=await json(u,{headers:{Authorization:"Bearer "+process.env.FEEDICO_API_KEY}});
  return (d.merchants||d.data||[]).map(x=>({...x,provider:"feedico"}));
}

export default async req=>{
 try{
  const u=new URL(req.url);
  const q=(u.searchParams.get("q")||"").trim().slice(0,120);
  if(req.method==="GET"&&u.pathname.endsWith("/status")) return out({ok:true,providers:providerStatus()});
  if(req.method==="GET"&&u.pathname.endsWith("/offers")){
    const merchantId=(u.searchParams.get("merchantId")||"").trim();
    if(!merchantId)return out({error:"merchantId requis."},400);
    const offers=await capitisOffers(merchantId);
    return out({ok:true,merchantId,count:offers.length,offers});
  }
  if(req.method!=="GET") return out({error:"GET requis."},405);
  const all=[];
  for(const fn of [catuik,capitis,feedico]){try{all.push(...await fn(q))}catch(e){console.error(e.message)}}
  const seen=new Set();
  const merchants=all.filter(x=>{
    const id=String(x.id||x.merchantId||x.name||"").toLowerCase();
    if(!id||seen.has(id)) return false; seen.add(id); return true;
  }).slice(0,100);
  await store.setJSON("catalog/latest",{updatedAt:new Date().toISOString(),query:q,count:merchants.length,merchants});
  return out({ok:true,query:q,count:merchants.length,providers:providerStatus(),merchants,source:"capitis-catalog"});
 }catch(e){console.error(e);return out({error:"Catalogue indisponible."},500)}
};
export const config={path:"/api/cashback-providers"};
