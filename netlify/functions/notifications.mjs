const BASE_URL=process.env.RECUPERE_BASE_URL||"https://jade-pegasus-f6e204.netlify.app";
export async function sendCustomerEmail({to,name,subject,title,body,caseNumber,idempotencyKey}) {
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM;
 if(!key||!from||!to)return {sent:false,reason:"email_not_configured"};
 const portalUrl=BASE_URL+"/portal/";
 const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#18352d"><h2>RÉCUPÈRE</h2><p>Bonjour ${escapeHtml(name||"")},</p><h3>${escapeHtml(title)}</h3><p style="white-space:pre-line">${escapeHtml(body)}</p><p><a href="${portalUrl}" style="display:inline-block;background:#18352d;color:white;padding:12px 18px;border-radius:999px;text-decoration:none">Accéder à mon dossier</a></p><p style="font-size:12px;color:#63756f">Dossier ${escapeHtml(caseNumber)}. Aucun envoi de réclamation n'est effectué sans validation.</p></div>`;
 const idem=String(idempotencyKey||(`${caseNumber||"general"}|${subject||"message"}`)).slice(0,256);
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":idem},body:JSON.stringify({from,to,subject,html})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){console.error("Resend error",d);return {sent:false,reason:"provider_error"}}
 return {sent:true,id:d.id};
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({["&"]:"&amp;",["<"]:"&lt;",[">"]:"&gt;",["\""]:"&quot;",["'"]:"&#039;"}[m]));}