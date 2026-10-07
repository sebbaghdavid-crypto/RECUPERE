import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
async function sync(){
 if(!(process.env.AWIN_API_TOKEN&&process.env.AWIN_PUBLISHER_ID))return 0;
 const end=new Date(),start=new Date(Date.now()-31*86400000);
 const url="https://api.awin.com/publishers/"+process.env.AWIN_PUBLISHER_ID+"/transactions/?startDate="+encodeURIComponent(start.toISOString())+"&endDate="+encodeURIComponent(end.toISOString())+"&timezone=Europe%2FParis";
 const r=await fetch(url,{headers:{Authorization:"Bearer "+process.env.AWIN_API_TOKEN}});if(!r.ok)throw Error("AWIN_TRANSACTIONS_"+r.status);
 const txs=await r.json();let n=0;
 for(const tx of Array.isArray(txs)?txs:[]){
  const id=String(tx.id||tx.transactionId||"");if(!id)continue;const key="transaction/"+id;const item=await store.get(key,{type:"json",consistency:"strong"});if(!item)continue;
  const status=String(tx.status||"").toUpperCase();if(status===String(item.status))continue;
  const old=item.status;item.status=status||item.status;item.updatedAt=new Date().toISOString();await store.setJSON(key,item);
  if(old==="PENDING"&&["APPROVED","DECLINED","DELETED"].includes(item.status)){
   const wk="wallet/"+String(item.email).replace(/[^a-z0-9@._-]/gi,"_");const w=await store.get(wk,{type:"json",consistency:"strong"})||{email:item.email,pending:0,approved:0,paid:0,transactions:[]};
   w.pending=money(w.pending-item.cashbackAmount);
   if(item.status==="APPROVED")w.approved=money(w.approved+item.cashbackAmount);
   await store.setJSON(wk,w);
  } n++;
 }
 return n;
}
export default async()=>{try{console.log("cashback sync",await sync())}catch(e){console.error("cashback sync error",e.message)}};
export const config={schedule:"15 8 * * *"};