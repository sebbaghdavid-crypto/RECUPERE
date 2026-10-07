import { getStore } from "@netlify/blobs";
import { sendCustomerEmail } from "./notifications.mjs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const days=n=>new Date(Date.now()+n*86400000).toISOString();
export default async ()=>{
 let processed=0;
 for await(const page of store.list({prefix:"case/",paginate:true})){
  for(const blob of page.blobs){
   const item=await store.get(blob.key,{type:"json",consistency:"strong"});
   if(!item||!["SENT","FOLLOW_UP"].includes(item.status))continue;
   if(item.nextFollowUpAt&&new Date(item.nextFollowUpAt)>new Date())continue;
   if((item.followUpCount||0)>=5)continue;
   const count=(item.followUpCount||0)+1;
   const result=await sendCustomerEmail({to:item.email,name:item.name,caseNumber:item.caseNumber,subject:"RÉCUPÈRE — suivi de votre dossier "+item.caseNumber,title:"Suivi de votre demande",body:"Nous revenons vers vous concernant votre dossier RÉCUPÈRE. Si vous n'avez pas encore reçu de réponse de l'organisme concerné, vous pouvez consulter votre espace pour retrouver les éléments de votre démarche."});
   if(!result.sent){console.error("follow-up email not sent",item.caseNumber,result.reason);continue}
   const now=new Date().toISOString();
   item.status="FOLLOW_UP";item.followUpCount=count;item.lastFollowUpAt=now;item.nextFollowUpAt=days(count===1?7:14);item.updatedAt=now;
   item.events=Array.isArray(item.events)?item.events:[];item.events.push({at:now,type:"FOLLOW_UP_SENT",count});
   await store.setJSON(blob.key,item);processed++;
  }
 }
 console.log("RECUPERE follow-ups sent:",processed);
};
export const config={schedule:"15 7 * * *"};