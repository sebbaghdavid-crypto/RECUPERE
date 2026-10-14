export function statusOf(tx) {
  const s=String(tx?.status||tx?.state||"").toUpperCase();
  if(["APPROVED","VALIDATED","CONFIRMED","PAYABLE"].includes(s)) return "APPROVED";
  if(["PAID","SETTLED"].includes(s)) return "APPROVED";
  if(["DECLINED","REJECTED","CANCELLED","DELETED","REVERSED"].includes(s)) return "DECLINED";
  return "PENDING";
}
export function money(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0;}

export function payoutEligible(tx) {
  return statusOf(tx) === "APPROVED"
    && String(tx?.currency || "").trim().toUpperCase() === "EUR"
    && tx?.cashbackAmount !== undefined
    && money(tx.cashbackAmount) > 0
    && money(tx.cashbackAmount) <= Math.max(0, money(tx.commission));
}

export function customerWasPaid(item){
  return String(item?.payoutStatus||"").toUpperCase()==="PAID" ||
    (String(item?.status||"").toUpperCase()==="PAID" && String(item?.source||"").toUpperCase()==="CAPITIS");
}
export function preserveCustomerPayoutStatus(item){
  if(customerWasPaid(item))item.payoutStatus="PAID";
  return item;
}
export function isLegacyCapitis(item){
  return String(item?.source||"").toUpperCase()==="CAPITIS";
}

export function cashbackShare(value){
 if(value===null||value===undefined||String(value).trim()==="")return 80;
 const n=Number(value);
 return Number.isFinite(n)?Math.min(100,Math.max(0,n)):80;
}
