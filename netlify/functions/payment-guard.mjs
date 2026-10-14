export function paymentConfiguration({enabled,secretKey,priceId}={}) {
 if(enabled!=="true") return {ok:false,reason:"disabled"};
 if(typeof secretKey!=="string"||!secretKey.startsWith("sk_test_")) return {ok:false,reason:"test_key_required"};
 if(typeof priceId!=="string"||!/^price_[A-Za-z0-9]+$/.test(priceId)) return {ok:false,reason:"test_price_required"};
 return {ok:true,mode:"test"};
}
