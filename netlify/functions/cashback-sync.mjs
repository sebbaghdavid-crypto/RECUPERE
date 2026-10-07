import {getStore} from "@netlify/blobs";
import {statusOf,money} from "./cashback-ledger.mjs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const auth=()=>({Authorization:"Bearer "+process.env.CAPITIS_API_KEY,"content-type":"application/json"});
const list=x=>Array.isArray(x)?x:(x?.data||x?.conversions||[]);
async function findClick(token){
 if(!token)return null;
 return await store.get("click-token/"+token,{type:"json",consistency:"strong"})||null;
}
async function sync(){
 if(!process.env.CAPITIS_API_KEY)return {processed:0,reason:"capitis_not_configured"};
 let processed=0,unmatched=0,pages=0,offset=0,hasMore=true;
 while(hasMore && pages<10){
  const r=await fetch("https://api.capitis.app/v1/conversions?limit=100&offset="+offset,{headers:auth()});
  if(!r.ok)throw Error("CAPITIS_CONVERSIONS_"+r.status);
  const data=await r.json();
  pages++;
  const rows=list(data);
  for(const tx of rows){
   const id=String(tx.id||tx.conversionId||tx.transactionId||"");
   if(!id)continue;
   const clickToken=String(tx.clickToken||tx.click_token||tx.attribution?.clickToken||"");
   const click=await findClick(clickToken);
   if(!click){unmatched++;continue;}
   const commission=money(tx.netPayout??tx.net_payout??tx.commission??tx.commissionAmount);
   const currency=String(tx.currency||tx.currencyCode||tx.netPayoutCurrency||"EUR").toUpperCase();
   const share=Math.min(100,Math.max(0,Number(process.env.RECUPERE_CASHBACK_SHARE||80)));
   const cashback=money(Math.max(0,commission*share/100));
   const newStatus=statusOf(tx);
   const payoutEligible=newStatus==="APPROVED" && currency==="EUR" && cashback>0 && cashback<=commission;
   const key="transaction/"+id;
   let item=await store.get(key,{type:"json",consistency:"strong"});
   if(!item){
    item={transactionId:id,clickToken,clickref:click.clickref,offerId:click.offerId,merchant:click.merchant,email:click.email,
     transactionAmount:money(tx.saleAmount??tx.amount),commission,cashbackRate:share,cashbackAmount:cashback,
     currency,status:newStatus,payoutEligible,source:"CAPITIS",createdAt:new Date().toISOString()};
   }else{
    item.commission=commission;
    item.cashbackAmount=cashback;
    item.currency=currency;
    item.status=newStatus;
    item.payoutEligible=payoutEligible;
   }
   item.rawStatus=String(tx.status||tx.state||"");
   item.updatedAt=new Date().toISOString();
   await store.setJSON(key,item);
   processed++;
  }
  const meta=data?.meta||{};
  hasMore=Boolean(meta.has_more) && rows.length>0;
  const nextOffset=Number(meta.offset);
  offset=Number.isFinite(nextOffset) && nextOffset>offset ? nextOffset : offset+rows.length;
  if(rows.length===0)hasMore=false;
 }
 return {processed,unmatched,pages};
}
export default async()=>{try{console.log("RECUPERE Capitis reconciliation",await sync())}catch(e){console.error("cashback sync error",e.message)}};
export {sync,statusOf,money};
export const config={schedule:"15 8 * * *"};