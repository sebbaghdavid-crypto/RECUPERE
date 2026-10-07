import { getStore } from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=500)=>String(v??"").trim().slice(0,n);

async function offers(){
 const raw=process.env.RECUPERE_CASHBACK_OFFERS;
 if(raw){try{const x=JSON.parse(raw);if(Array.isArray(x))return x.filter(o=>o&&o.active!==false)}catch{}}
 return [];
}

async function capitisRequest(path, options={}){
 const key=process.env.CAPITIS_API_KEY;
 if(!key) throw Error("CAPITIS_NOT_CONFIGURED");
 const r=await fetch("https://api.capitis.app/v1"+path,{
   ...options,
   headers:{Authorization:"Bearer "+key,"content-type":"application/json",...(options.headers||{})}
 });
 if(!r.ok){const t=await r.text();throw Error("CAPITIS_"+r.status+":"+t.slice(0,300))}
 return r.json();
}

async function digest(value){
 const salt=process.env.CAPITIS_ID_SALT;
 if(!salt) throw Error("CAPITIS_ID_SALT_NOT_CONFIGURED");
 const data=new TextEncoder().encode(salt+":"+value);
 const hash=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function capitisUser(email){
 const externalId="rcp_"+(await digest(email)).slice(0,32);
 const key="capitis-user/"+externalId;
 const cached=await store.get(key,{type:"json",consistency:"strong"});
 if(cached?.id)return cached;
 const d=await capitisRequest("/end-users",{method:"POST",body:JSON.stringify({external_id:externalId})});
 const user={id:d.id||d.end_user_id||d.external_id||externalId,externalId};
 const identifierHash=await digest(email);\n const identifier=await capitisRequest("/end-users/"+encodeURIComponent(user.id)+"/identifiers",{method:"POST",body:JSON.stringify({type:"email",value:identifierHash})}).catch(e=>null);
 if(identifier===null) throw Error("CAPITIS_IDENTIFIER_ERROR");
 await store.setJSON(key,user);
 return user;
}

async function capitisLink(offer,email){
 if(!offer.merchantId) throw Error("CAPITIS_MERCHANT_ID_MISSING");
 const user=await capitisUser(email||"anonymous@recupere.local");
 const d=await capitisRequest("/links",{method:"POST",body:JSON.stringify({
   end_user_external_id:user.externalId,
   merchant_id:String(offer.merchantId),
   campaign:offer.campaign||"recupere-cashback"
 })});
 return {url:d.url,clickToken:d.click_token||d.clickToken};
}

export default async req=>{try{
 const u=new URL(req.url);
 if(req.method==="GET"){
   const os=await offers();
   return out({ok:true,trackingConfigured:Boolean(process.env.CAPITIS_API_KEY||process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID),providers:{capitis:Boolean(process.env.CAPITIS_API_KEY),awin:Boolean(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID)},offers:os.map(o=>({...o,trackingReady:Boolean((o.provider==="capitis"&&process.env.CAPITIS_API_KEY&&o.merchantId)||(o.trackingUrlTemplate)||(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID&&o.advertiserId))}))});
 }
 if(req.method==="POST"){
   const b=await req.json().catch(()=>null);
   if(!b||b.action!=="click")return out({error:"Action invalide."},400);
   const o=(await offers()).find(x=>String(x.id)===clean(b.offerId,100));
   if(!o)return out({error:"Offre introuvable."},404);
   const email=clean(b.email,254).toLowerCase();
   const clickref="rcp_"+crypto.randomUUID().replaceAll("-","").slice(0,24);
   let trackingUrl=null,clickToken=null;
   if(o.provider==="capitis"){
     const link=await capitisLink(o,email);
     trackingUrl=link.url;clickToken=link.clickToken;
   } else if(o.trackingUrlTemplate){
     trackingUrl=o.trackingUrlTemplate.replace("{clickref}",encodeURIComponent(clickref));
   } else if(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID&&o.advertiserId){
     const r=await fetch("https://api.awin.com/publishers/"+process.env.AWIN_PUBLISHER_ID+"/linkbuilder/generate",{method:"POST",headers:{Authorization:"Bearer "+process.env.AWIN_API_TOKEN,"content-type":"application/json"},body:JSON.stringify({advertiserId:Number(o.advertiserId),destinationUrl:o.destinationUrl,parameters:{clickref}})});
     if(!r.ok)throw Error("AWIN_LINK_ERROR"); const d=await r.json();trackingUrl=d.url||o.destinationUrl;
   } else trackingUrl=o.destinationUrl;
   await store.setJSON("click/"+clickref,{clickref,clickToken,offerId:o.id,merchant:o.merchant,merchantId:o.merchantId||null,provider:o.provider||"custom",email,createdAt:new Date().toISOString(),status:"CLICKED"});
   return out({ok:true,clickref,clickToken,trackingUrl},201);
 }
 return out({error:"Méthode non supportée."},405);
}catch(e){console.error(e);return out({error:"Service cashback indisponible.",detail:process.env.NODE_ENV==="development"?e.message:undefined},500)}};
export const config={path:"/api/cashback"};