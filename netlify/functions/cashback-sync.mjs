import {getStore} from "@netlify/blobs";
import {cashbackSyncEnabled} from "./cashback-feature-guard.mjs";
import {statusOf,money,preserveCustomerPayoutStatus,isLegacyCapitis,cashbackShare} from "./cashback-ledger.mjs";

const store=getStore({name:"recupere-cashback",region:"eu-central-1"});
const auth=()=>({Authorization:"Bearer "+process.env.CAPITIS_API_KEY,"content-type":"application/json"});
const list=x=>Array.isArray(x)?x:(x?.data||x?.conversions||[]);
async function findClick(token){if(!token)return null;return await store.get("click-token/"+token,{type:"json",consistency:"strong"})||null}
async function acquireLock(key,ttl=300000){
 const now=Date.now(),current=await store.getWithMetadata(key,{type:"json",consistency:"strong"});
 if(!current)return (await store.setJSON(key,{lockedAt:now,expiresAt:now+ttl},{onlyIfNew:true})).modified;
 const data=current.data||{};
 if(Number(data.expiresAt)>now)return false;
 return (await store.setJSON(key,{lockedAt:now,expiresAt:now+ttl},{onlyIfMatch:current.etag})).modified;
}
// The lease expires automatically. Do not delete unconditionally: an older
// run could otherwise delete a newer run's lock after its lease was renewed.

function providerRecordKey(id){return "transaction/capitis/"+id}
async function locateRecord(id){
 const canonical=providerRecordKey(id);
 const current=await store.getWithMetadata(canonical,{type:"json",consistency:"strong"});
 if(current?.data)return {key:canonical,item:current.data,etag:current.etag,exists:true};
 const legacyKey="transaction/"+id;
 const legacy=await store.getWithMetadata(legacyKey,{type:"json",consistency:"strong"});
 // Never let a Capitis conversion overwrite an AWIN record with the same provider ID.
 if(legacy?.data&&isLegacyCapitis(legacy.data))return {key:legacyKey,item:legacy.data,etag:legacy.etag,exists:true};
 return {key:canonical,item:null,etag:null,exists:false};
}
async function sync(){
 if(!cashbackSyncEnabled())return {processed:0,reason:"cashback_sync_disabled"};
 if(!process.env.CAPITIS_API_KEY)return {processed:0,reason:"capitis_not_configured"};
 const lockKey="lock/capitis-sync";
 if(!await acquireLock(lockKey))return {processed:0,reason:"sync_already_running"};
 try{
  let processed=0,unmatched=0,pages=0,offset=0,hasMore=true;
  while(hasMore&&pages<10){
   const r=await fetch("https://api.capitis.app/v1/conversions?limit=100&offset="+offset,{headers:auth()});
   if(!r.ok)throw Error("CAPITIS_CONVERSIONS_"+r.status);
   const data=await r.json();pages++;
   const rows=list(data);
   for(const tx of rows){
    const id=String(tx.id||tx.conversionId||tx.transactionId||"");if(!id)continue;
    const clickToken=String(tx.clickToken||tx.click_token||tx.attribution?.clickToken||"");
    const click=await findClick(clickToken);if(!click){unmatched++;continue}
    const commission=money(tx.netPayout??tx.net_payout??tx.commission??tx.commissionAmount);
    const currency=String(tx.currency||tx.currencyCode||tx.netPayoutCurrency||"UNKNOWN").toUpperCase();
    const share=cashbackShare(process.env.RECUPERE_CASHBACK_SHARE??80);
    const cashback=money(Math.max(0,commission*share/100)),providerStatus=statusOf(tx);
    const eligible=providerStatus==="APPROVED"&&currency==="EUR"&&cashback>0&&cashback<=commission;
    const found=await locateRecord(id);
    const now=new Date().toISOString();
    const item=found.item||{
      transactionId:id,clickToken,clickref:click.clickref,offerId:click.offerId,
      merchant:click.merchant,email:click.email,transactionAmount:money(tx.saleAmount??tx.amount),
      cashbackRate:share,source:"CAPITIS",createdAt:now
    };
    // Migrate the historical overloaded PAID value before replacing provider status.
    preserveCustomerPayoutStatus(item);
    item.transactionId=id;
    item.clickToken=clickToken||item.clickToken;
    item.clickref=item.clickref||click.clickref;
    item.offerId=item.offerId||click.offerId;
    item.merchant=item.merchant||click.merchant;
    item.email=item.email||click.email;
    item.transactionAmount=money(tx.saleAmount??tx.amount??item.transactionAmount);
    item.commission=commission;
    item.cashbackRate=share;
    item.cashbackAmount=cashback;
    item.currency=currency;
    item.providerStatus=providerStatus;
    // Keep the legacy status field as the provider/conversion status only.
    item.status=providerStatus;
    item.payoutEligible=eligible && item.payoutStatus!=="PAID";
    item.source="CAPITIS";
    item.rawStatus=String(tx.status||tx.state||"");
    item.updatedAt=now;
    const saved=found.exists
      ? await store.setJSON(found.key,item,{onlyIfMatch:found.etag})
      : await store.setJSON(found.key,item,{onlyIfNew:true});
    // If another run changed this record after it was read, do not overwrite it.
    if(!saved.modified)continue;
    processed++;
   }
   const meta=data?.meta||{};hasMore=Boolean(meta.has_more)&&rows.length>0;
   const nextOffset=Number(meta.offset);offset=Number.isFinite(nextOffset)&&nextOffset>offset?nextOffset:offset+rows.length;
   if(rows.length===0)hasMore=false;
  }
  return {processed,unmatched,pages};
 }finally{
  // Keep the lease until expiresAt. A conditional delete is not available
  // in this storage API, so never risk deleting a newer execution's lock.
 }
}
export default async()=>{try{console.log("RECUPERE Capitis reconciliation",await sync())}catch(e){console.error("cashback sync error",e.message)}};
export {sync,statusOf,money};
export const config={schedule:"15 8 * * *"};
