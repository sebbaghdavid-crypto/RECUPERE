import {getStore} from "@netlify/blobs";
import {createMagic,consumeMagic,getSession,sessionCookie} from "./auth.mjs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const BASE_URL=process.env.RECUPERE_BASE_URL||"https://jade-pegasus-f6e204.netlify.app";
const clean=v=>String(v??"").trim().slice(0,254);
const response=(b,s=200,h={})=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
async function findCase(n){for await(const page of store.list({prefix:"case/",paginate:true})){for(const item of page.blobs){const c=await store.get(item.key,{type:"json",consistency:"strong"});if(c?.caseNumber===n)return c}}return null}
async function emailLink(email){
 let exists=false;
 for await(const page of store.list({prefix:"case/",paginate:true})){for(const item of page.blobs){const c=await store.get(item.key,{type:"json",consistency:"strong"});if(c&&String(c.email).toLowerCase()===email){exists=true;break}}if(exists)break}
 if(!exists)return;
 const raw=await createMagic(email),key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM;
 if(!key||!from)return;
 const link=BASE_URL+"/portal/?magic="+encodeURIComponent(raw);
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:email,subject:"RÉCUPÈRE — votre lien de connexion",html:`<p>Accédez à votre espace RÉCUPÈRE :</p><p><a href="${link}">Se connecter</a></p><p>Ce lien expire dans 15 minutes et ne peut être utilisé qu'une seule fois.</p>`})});
 if(!r.ok)throw Error("AUTH_EMAIL_ERROR");
}
export default async req=>{try{
 const u=new URL(req.url);
 if(req.method==="POST"){
  const b=await req.json().catch(()=>null);
  if(b?.action==="request_link"){const email=clean(b.email).toLowerCase();if(!email||!email.includes("@"))return response({error:"Adresse e-mail invalide."},400);await emailLink(email);return response({ok:true});}
  if(b?.action==="logout")return new Response(null,{status:204,headers:{"Set-Cookie":sessionCookie("",0)}});
  return response({error:"Action invalide."},400);
 }
 if(req.method!=="GET")return response({error:"Méthode non supportée."},405);
 const magic=u.searchParams.get("magic");
 if(magic){const s=await consumeMagic(magic);if(!s)return response({error:"Lien invalide ou expiré."},401);return new Response(null,{status:302,headers:{"Location":"/portal/","Set-Cookie":sessionCookie(s),"Cache-Control":"no-store"}})}
 const s=await getSession(req);if(!s)return response({authenticated:false});
 const n=clean(u.searchParams.get("case"));if(!n)return response({authenticated:true,email:s.email});
 const found=await findCase(n);if(!found||String(found.email).toLowerCase()!==s.email)return response({error:"Dossier introuvable ou accès refusé."},404);
 const {accessToken,...safe}=found;return response({authenticated:true,...safe});
}catch(e){console.error("portal auth error",e);return response({error:"Erreur serveur."},500)}};
export const config={path:"/api/portal"};