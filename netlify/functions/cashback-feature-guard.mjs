export function cashbackPublicEnabled(env=process.env) {
 return env.RECUPERE_CASHBACK_ENABLED==="true";
}
export function cashbackSyncEnabled(env=process.env) {
 return cashbackPublicEnabled(env) && env.RECUPERE_CASHBACK_SYNC_ENABLED==="true";
}
