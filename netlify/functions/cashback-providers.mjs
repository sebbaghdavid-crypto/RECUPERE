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
  const u=new URL(process.env.CAPITIS_API_URL||"https://api.capitis.app/v1/merchants");
  if(q) u.searchParams.set("search",q);
  const d=await json(u,{headers:{Authorization:"Bearer "+process.env.CAPITIS_API_KEY}});
  return (d.merchants||d.data||[]).map(x=>({...x,provider:"capitis"}));
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
  if(req.method!=="GET") return out({error:"GET requis."},405);
  const all=[];
  for(const fn of [catuik,capitis,feedico]){try{all.push(...await fn(q))}catch(e){console.error(e.message)}}
  const seen=new Set();
  const merchants=all.filter(x=>{
    const id=String(x.id||x.merchantId||x.name||"").toLowerCase();
    if(!id||seen.has(id)) return false; seen.add(id); return true;
  }).slice(0,100);
  await store.setJSON("catalog/latest",{updatedAt:new Date().toISOString(),query:q,count:merchants.length,merchants});
  return out({ok:true,query:q,count:merchants.length,providers:providerStatus(),merchants});
 }catch(e){console.error(e);return out({error:"Catalogue indisponible."},500)}
};
export const config={path:"/api/cashback-providers"};
