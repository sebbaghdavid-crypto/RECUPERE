export function checkoutSessionDisposition(payment,sessionId){
 if(!payment?.checkoutSessionId)return "retry";
 return payment.checkoutSessionId===sessionId?"match":"stale";
}
