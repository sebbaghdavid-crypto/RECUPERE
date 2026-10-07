import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const authStore=getStore({name:"recupere-auth",region:"eu-central-1"});
const hash=async v=>{const b=new TextEncoder().encode(String(v||"").trim().toLowerCase()),h=await crypto.subtle.digest("SHA-256",b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")};
const caseKey=token=>"case/"+token;
export async function indexCase(item){
 if(!item?.email||!item?.accessToken)return false;
 const h=await hash(item.email);
 const r=await authStore.setJSON("owner/"+h+"/"+item.caseNumber,{caseKey:caseKey(item.accessToken),caseNumber:item.caseNumber,createdAt:item.createdAt},{onlyIfNew:true});
 return r.modified||true;
}
export async function listOwnedCases(email){
 if(!email)return [];
 const h=await hash(email),out=[];
 for await(const page of authStore.list({prefix:"owner/"+h+"/",paginate:true})){
  for(const blob of page.blobs){
   const ref=await authStore.get(blob.key,{type:"json",consistency:"strong"});
   if(!ref?.caseKey)continue;
   const item=await store.get(ref.caseKey,{type:"json",consistency:"strong"});
   if(item&&String(item.email).toLowerCase()===String(email).toLowerCase()){const {accessToken,...safe}=item;out.push(safe)}
  }
 }
 return out.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}
export async function findOwnedCaseRaw(email,caseNumber){
 if(!email||!caseNumber)return null;
 const h=await hash(email),ref=await authStore.get("owner/"+h+"/"+caseNumber,{type:"json",consistency:"strong"});
 if(!ref?.caseKey){
  for await(const page of store.list({prefix:"case/",paginate:true})) for(const blob of page.blobs){const item=await store.get(blob.key,{type:"json",consistency:"strong"});if(item?.caseNumber===caseNumber&&String(item.email).toLowerCase()===String(email).toLowerCase()){await indexCase(item);return item}}
  return null;
 }
 const item=await store.get(ref.caseKey,{type:"json",consistency:"strong"});
 if(!item||String(item.email).toLowerCase()!==String(email).toLowerCase())return null;
 return item;
}
export async function findOwnedCase(email,caseNumber){
 const item=await findOwnedCaseRaw(email,caseNumber);if(!item)return null;const {accessToken,...safe}=item;return safe;
}
export async function updateCase(token,mutator,retries=5){
 if(!token)return {ok:false,reason:"missing"};
 const key=caseKey(token);
 for(let i=0;i<retries;i++){
  const current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});
  if(!current?.data)return {ok:false,reason:"not_found"};
  const before=current.data;
  const next=await mutator(structuredClone(before));
  if(!next)return {ok:false,reason:"rejected",item:before};
  next.updatedAt=new Date().toISOString();
  const written=await store.setJSON(key,next,{onlyIfMatch:current.etag});
  if(written.modified)return {ok:true,item:next};
 }
 return {ok:false,reason:"conflict"};
}
import {canTransition} from "./case-state.mjs";
export {canTransition};
export async function transitionCase(token,to,event={},retries=5){
 return updateCase(token,item=>{
  if(!canTransition(item.status,to))return null;
  const now=new Date().toISOString();item.status=to;item.events=Array.isArray(item.events)?item.events:[];item.events.push({at:now,type:event.type||"STATUS_CHANGED",status:to,...event});return item;
 },retries);
}
