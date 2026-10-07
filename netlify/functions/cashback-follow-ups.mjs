import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
async function claim(key){
 const current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});if(!current?.data||current.data.status!=="CLICKED")return false;
 if(Date.now()-new Date(current.data.createdAt).getTime()<7*86400000)return false;
 const next={...current.data,status:"PENDING_CONFIRMATION",updatedAt:new Date().toISOString()};
 return (await store.setJSON(key,next,{onlyIfMatch:current.etag})).modified;
}
export default async()=>{let processed=0;for await(const page of store.list({prefix:"click/",paginate:true})){for(const blob of page.blobs)if(await claim(blob.key))processed++}console.log("cashback follow-up",processed)};
export const config={schedule:"45 7 * * *"};