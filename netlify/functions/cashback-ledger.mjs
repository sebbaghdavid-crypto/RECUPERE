export function statusOf(tx) {
  const s=String(tx?.status||tx?.state||"").toUpperCase();
  if(["APPROVED","VALIDATED","CONFIRMED","PAYABLE"].includes(s)) return "APPROVED";
  if(["PAID","SETTLED"].includes(s)) return "PAID";
  if(["DECLINED","REJECTED","CANCELLED","DELETED","REVERSED"].includes(s)) return "DECLINED";
  return "PENDING";
}
export function money(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:0;}

export function payoutEligible(tx) {
  return statusOf(tx) === "APPROVED"
    && String(tx?.currency || "EUR").toUpperCase() === "EUR"
    && tx?.cashbackAmount !== undefined
    && money(tx.cashbackAmount) > 0
    && money(tx.cashbackAmount) <= Math.max(0, money(tx.commission));
}
