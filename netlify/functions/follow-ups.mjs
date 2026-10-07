import {getStore} from "@netlify/blobs";
import {sendCustomerEmail} from "./notifications.mjs";
import {updateCase} from "./case-store.mjs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const days=n=>new Date(Date.now()+n*86400000).toISOString();
async function claimCase(key,ttl=300000){
 const lockKey="follow-lock/"+key.replaceAll("/","_"),now=Date.now(),current=await store.getWithMetadata(lockKey,{type:"json",consistency:"strong"});
 if(!current)return (await store.setJSON(lockKey,{claimedAt:now,expiresAt:now+ttl},{onlyIfNew:true})).modified;
 const data=current.data||{};if(Number(data.expiresAt)>now)return false;
 return (await store.setJSON(lockKey,{claimedAt:now,expiresAt:now+ttl},{onlyIfMatch:current.etag})).modified;
}
async function releaseCase(key){await store.delete("follow-lock/"+key.replaceAll("/","_"))}
export default async()=>{
 let processed=0;
 for await(const page of store.list({prefix:"case/",paginate:true})){
  for(const blob of page.blobs){
   const item=await store.get(blob.key,{type:"json",consistency:"strong"});
   if(!item||!["SENT","FOLLOW_UP"].includes(item.status))continue;
   if(item.nextFollowUpAt&&new Date(item.nextFollowUpAt)>new Date())continue;
   if((item.followUpCount||0)>=5)continue;
   if(!await claimCase(blob.key))continue;
   try{
    const latest=await store.get(blob.key,{type:"json",consistency:"strong"});
    if(!latest||!["SENT","FOLLOW_UP"].includes(latest.status)||(latest.nextFollowUpAt&&new Date(latest.nextFollowUpAt)>new Date())||(latest.followUpCount||0)>=5)continue;
    const count=(latest.followUpCount||0)+1;
    const result=await sendCustomerEmail({to:latest.email,name:latest.name,caseNumber:latest.caseNumber,subject:"RÉCUPÈRE — suivi de votre dossier "+latest.caseNumber,title:"Suivi de votre demande",body:"Nous revenons vers vous concernant votre dossier RÉCUPÈRE. Si vous n'avez pas encore reçu de réponse de l'organisme concerné, vous pouvez consulter votre espace pour retrouver les éléments de votre démarche.",idempotencyKey:"follow-up|"+latest.caseNumber+"|"+count});
    if(!result.sent){console.error("follow-up email not sent",latest.caseNumber,result.reason);continue}
    const now=new Date().toISOString();
    const updateResult=await updateCase(latest.accessToken,current=>{
      if(!["SENT","FOLLOW_UP"].includes(current.status)||(current.nextFollowUpAt&&new Date(current.nextFollowUpAt)>new Date())||(current.followUpCount||0)>=5)return null;
      current.status="FOLLOW_UP";current.followUpCount=count;current.lastFollowUpAt=now;current.nextFollowUpAt=days(count===1?7:14);current.events=Array.isArray(current.events)?current.events:[];current.events.push({at:now,type:"FOLLOW_UP_SENT",count});return current;
    });
    if(updateResult.ok)processed++;
   }finally{await releaseCase(blob.key)}
  }
 }
 console.log("RECUPERE follow-ups sent:",processed);
};
export const config={schedule:"15 7 * * *"};