import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-auth",region:"eu-central-1"});
const hash=async v=>{const b=new TextEncoder().encode(v),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")};
const token=()=>crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","").slice(0,16);
export async function createMagic(email){
 const normalized=String(email||"").trim().toLowerCase();
 const raw=token(),h=await hash(raw);
 await store.setJSON("magic/"+h,{email:normalized,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),used:false});
 return raw
}
export async function consumeMagic(raw){const h=await hash(raw),m=await store.get("magic/"+h,{type:"json",consistency:"strong"});if(!m||m.used||new Date(m.expiresAt)<=new Date())return null;m.used=true;m.usedAt=new Date().toISOString();await store.setJSON("magic/"+h,m);const rawSession=token(),s=await hash(rawSession);await store.setJSON("session/"+s,{email:m.email,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+604800000).toISOString()});return rawSession}
export async function getSession(req){const cookies=(req.headers.get("cookie")||"").split(";").map(x=>x.trim());const prefix="__Host-recuperesession=";const raw=cookies.find(x=>x.startsWith(prefix))?.slice(prefix.length);if(!raw)return null;const s=await store.get("session/"+await hash(raw),{type:"json",consistency:"strong"});if(!s||new Date(s.expiresAt)<=new Date())return null;return s}
export const sessionCookie=(value,maxAge=604800)=>`__Host-recuperesession=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;