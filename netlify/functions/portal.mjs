import { getStore } from "@netlify/blobs";
const store=getStore({name:"recupere-cases",region:"eu-central-1"});
const clean=v=>String(v??"").trim().slice(0,254);
function response(b,s=200){return new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
export default async req=>{
 try{
  if(req.method!=="GET")return response({error:"Méthode non supportée."},405);
  const u=new URL(req.url), caseNumber=clean(u.searchParams.get("case")),email=clean(u.searchParams.get("email")).toLowerCase();
  if(!caseNumber||!email)return response({error:"Dossier et email requis."},400);
  let found=null;
  for await(const page of store.list({prefix:"case/",paginate:true})){
   for(const item of page.blobs){
    const c=await store.get(item.key,{type:"json",consistency:"strong"});
    if(c&&c.caseNumber===caseNumber&&String(c.email).toLowerCase()===email){found=c;break}
   }
   if(found)break;
  }
  if(!found)return response({error:"Dossier introuvable ou email incorrect."},404);
  const {accessToken,...safe}=found;
  return response(safe);
 }catch(e){console.error(e);return response({error:"Erreur serveur."},500)}
};
export const config={path:"/api/portal"};