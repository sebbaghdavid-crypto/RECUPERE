import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-auth",region:"eu-central-1"});
const hash=async v=>{const b=new TextEncoder().encode(v),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")};
const token=()=>crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","").slice(0,16);
const windowMs=60_000;
async function rateLimit(scope,key,limit){
 const now=Date.now(),bucket=Math.floor(now/windowMs),safe=await hash(String(key||"")),k="rate/"+scope+"/"+safe;
 for(let attempt=0;attempt<4;attempt++){
  const current=await store.getWithMetadata(k,{type:"json",consistency:"strong"});
  const data=current?.data;
  if(data?.bucket===bucket && Number(data.count)>=limit)return false;
  const next=data?.bucket===bucket?Number(data.count||0)+1:1;
  const value={bucket,count:next,updatedAt:new Date(now).toISOString()};
  const write=data
   ? await store.setJSON(k,value,{onlyIfMatch:current.etag})
   : await store.setJSON(k,value,{onlyIfNew:true});
  if(write.modified)return true;
 }
 return false;
}
export async function allowMagicRequest(email,ip){
 const e=String(email||"").trim().toLowerCase(),i=String(ip||"unknown");
 return (await rateLimit("email",e,5)) && (await rateLimit("ip",i,20));
}
export async function allowCaseCreate(email,ip){
 const e=String(email||"").trim().toLowerCase(),i=String(ip||"unknown");
 return (await rateLimit("case-email",e,10)) && (await rateLimit("case-ip",i,30));
}
export async function allowPaymentRequest(ip){return rateLimit("payment-ip",String(ip||"unknown"),10)}
export async function allowAdminRequest(ip){return rateLimit("admin-ip",String(ip||"unknown"),20)}
export async function allowCashbackWebhookRequest(ip){return rateLimit("cashback-webhook-ip",String(ip||"unknown"),30)}
export async function createSession(email){
 const rawSession=token(),s=await hash(rawSession);
 await store.setJSON("session/"+s,{email:String(email||"").trim().toLowerCase(),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+604800000).toISOString()});
 return rawSession
}
export async function createMagic(email){
 const normalized=String(email||"").trim().toLowerCase(),raw=token(),h=await hash(raw);
 await store.setJSON("magic/"+h,{email:normalized,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),used:false});
 return raw
}
export async function consumeMagic(raw){
 const h=await hash(raw),key="magic/"+h;
 const current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});
 const m=current?.data;
 if(!m||m.used||new Date(m.expiresAt)<=new Date())return null;
 const used={...m,used:true,usedAt:new Date().toISOString()};
 const claimed=await store.setJSON(key,used,{onlyIfMatch:current.etag});
 if(!claimed.modified)return null;
 return await createSession(m.email)
}
export async function getSession(req){
 const cookies=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()),prefix="__Host-recuperesession=";
 const raw=cookies.find(x=>x.startsWith(prefix))?.slice(prefix.length);if(!raw)return null;
 const s=await store.get("session/"+await hash(raw),{type:"json",consistency:"strong"});
 if(!s||new Date(s.expiresAt)<=new Date())return null;return s
}
export const sessionCookie=(value,maxAge=604800)=>`__Host-recuperesession=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;