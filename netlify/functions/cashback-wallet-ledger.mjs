export const money=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0};

export function identity(key,tx){
 const source=String(tx?.source||"UNKNOWN").toUpperCase();
 const id=String(tx?.transactionId||key.slice(key.lastIndexOf("/")+1));
 return source+":"+id;
}
export function isCanonical(key,tx){
 const source=String(tx?.source||"").toLowerCase();
 return !!source&&key.startsWith("transaction/"+source+"/");
}
export function dedupeRecords(records){
 const unique=new Map();
 for(const record of records){
  const id=identity(record.key,record.tx),previous=unique.get(id);
  if(!previous||(isCanonical(record.key,record.tx)&&!isCanonical(previous.key,previous.tx)))unique.set(id,record);
 }
 return [...unique.values()];
}
export function summarizeWallet(records,minimumPayout=10){
 let pending=0,approved=0,paid=0;
 const transactions=[];
 for(const {tx} of records){
  const amount=money(tx.cashbackAmount),currency=String(tx.currency||"UNKNOWN").toUpperCase();
  const source=String(tx.source||"").toUpperCase();
  const knownSource=source==="CAPITIS"||source==="AWIN";
  const providerStatus=String(tx.providerStatus||tx.status||"").toUpperCase();
  const payoutStatus=String(tx.payoutStatus||"").toUpperCase();
  const legacyStatus=String(tx.status||"").toUpperCase();
  const providerExplicit=String(tx.providerStatus||"").trim()!=="";
  const ambiguousLegacyPaid=legacyStatus==="PAID"&&(!providerExplicit||!payoutStatus);
  const unsupportedCurrency=currency!=="EUR";
  if(knownSource&&!unsupportedCurrency&&!ambiguousLegacyPaid){
   if(payoutStatus==="PAID"&&providerExplicit)paid=money(paid+amount);
   else if(providerStatus==="PENDING")pending=money(pending+amount);
   else if(providerStatus==="APPROVED"&&tx.payoutEligible===true&&payoutStatus!=="PAID")approved=money(approved+amount);
  }
  const needsReview=!knownSource||ambiguousLegacyPaid||unsupportedCurrency;
  transactions.push({
   transactionId:tx.transactionId,status:needsReview?"REVIEW_REQUIRED":providerStatus,
   payoutStatus:payoutStatus|| (needsReview?"REVIEW_REQUIRED":"NOT_PAID"),
   cashbackAmount:tx.cashbackAmount,currency:tx.currency,merchant:tx.merchant,
   updatedAt:tx.updatedAt||tx.createdAt
  });
 }
 transactions.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
 const threshold=Math.max(0,money(minimumPayout));
 return {pending,approved,payable:approved,paid,minimumPayout:threshold,payoutEligible:approved>=threshold,transactions:transactions.slice(0,20)};
}
