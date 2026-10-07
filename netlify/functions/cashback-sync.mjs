import {getStore} from "@netlify/blobs";
const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};
const safeEmail=e=>String(e||"").toLowerCase().replace(/[^a-z0-9@._-]/gi,"_");
const auth=()=>({Authorization:"Bearer "+process.env.CAPITIS_API_KEY,"content-type":"application/json"});
const list=x=>Array.isArray(x)?x:(x?.data||x?.conversions||[]);
const statusOf=x=>{
 const s=String(x?.status||x?.state||"pending").toUpperCase();
 if(["APPROVED","VALIDATED","CONFIRMED","PAYABLE"].includes(s))return "APPROVED";
 if(["PAID","SETTLED"].includes(s))return "PAID";
 if(["DECLINED","REJECTED","CANCELLED","DELETED"].includes(s))return "DECLINED";
 return "PENDING";
};
async function findClick(token){
 if(!token)return null;
 return await store.get("click-token/"+token,{type:"json",consistency:"strong"})||null;
}
async function sync(){
 if(!process.env.CAPITIS_API_KEY)return {processed:0,reason:"capitis_not_configured"};
 const r=await fetch("https://api.capitis.app/v1/conversions?limit=100",{headers:auth()});
 if(!r.ok)throw Error("CAPITIS_CONVERSIONS_"+r.status);
 const data=await r.json();let processed=0,unmatched=0;
 for(const tx of list(data)){
  const id=String(tx.id||tx.conversionId||tx.transactionId||""); if(!id)continue;
  const clickToken=String(tx.clickToken||tx.click_token||tx.attribution?.clickToken||"");
  const click=await findClick(clickToken); if(!click){unmatched++;continue;}
  const commission=money(tx.netPayout??tx.net_payout??tx.commission??tx.commissionAmount);
  const share=Math.min(100,Math.max(0,Number(process.env.RECUPERE_CASHBACK_SHARE||80)));
  const cashback=money(Math.max(0,commission*share/100)),newStatus=statusOf(tx);
  const key="transaction/"+id;
  let item=await store.get(key,{type:"json",consistency:"strong"});
  const oldStatus=item?.status||null;
  if(!item){
   item={transactionId:id,clickToken,clickref:click.clickref,offerId:click.offerId,merchant:click.merchant,email:click.email,
    transactionAmount:money(tx.saleAmount??tx.amount),commission,cashbackRate:share,cashbackAmount:cashback,
    currency:String(tx.currency||tx.currencyCode||"EUR"),status:newStatus,source:"CAPITIS",createdAt:new Date().toISOString()};
  }else{
   item.commission=commission;item.cashbackAmount=cashback;item.status=newStatus;
  }
  item.rawStatus=String(tx.status||tx.state||"");item.updatedAt=new Date().toISOString();await store.setJSON(key,item);processed++;
 }
 return {processed,unmatched};
}
export default async()=>{try{console.log("RECUPERE Capitis reconciliation",await sync())}catch(e){console.error("cashback sync error",e.message)}};
export {sync,statusOf,money};
export const config={schedule:"15 8 * * *"};