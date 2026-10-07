import { getStore } from "@netlify/blobs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const days=n=>new Date(Date.now()+n*86400000).toISOString();
export default async ()=>{
 let processed=0;
 for await(const page of store.list({prefix:"case/",paginate:true})){
  for(const blob of page.blobs){
   const item=await store.get(blob.key,{type:"json",consistency:"strong"});
   if(!item || !["SENT","FOLLOW_UP"].includes(item.status)) continue;
   if(item.nextFollowUpAt && new Date(item.nextFollowUpAt)>new Date()) continue;
   if((item.followUpCount||0)>=5) continue;
   const count=(item.followUpCount||0)+1;
   item.status="FOLLOW_UP";
   item.followUpCount=count;
   item.lastFollowUpAt=new Date().toISOString();
   item.nextFollowUpAt=days(count===1?7:14);
   item.updatedAt=new Date().toISOString();
   item.events=Array.isArray(item.events)?item.events:[];
   item.events.push({at:item.updatedAt,type:"FOLLOW_UP_DUE",count});
   await store.setJSON(blob.key,item);
   processed++;
  }
 }
 console.log("RECUPERE follow-ups due:",processed);
};
export const config={schedule:"15 7 * * *"};
