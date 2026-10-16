export function checkoutSessionDisposition(payment,sessionId){
 if(!payment?.checkoutSessionId)return "retry";
 return payment.checkoutSessionId===sessionId?"match":"stale";
}

export function isStripeTestEvent(event){
 return event?.livemode===false;
}
