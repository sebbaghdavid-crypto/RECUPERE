function esc(v){return String(v??"").trim();}
function dateFr(){return new Date().toLocaleDateString("fr-FR");}

export function buildClaim(item){
  const name=esc(item.name), company=esc(item.company)||"le professionnel / organisme concerné";
  const ref=esc(item.reference);
  const amount=esc(item.amount);
  const est=item.estimatedRecovery!=null ? `${item.estimatedRecovery} €` : null;
  const desc=esc(item.description);
  let subject="Demande de régularisation de mon dossier";
  let body=`Madame, Monsieur,

Je vous contacte au sujet de la situation suivante :

${desc}

${ref ? "Référence / commande : "+ref+"\n" : ""}${amount ? "Montant concerné : "+amount+" €\n" : ""}

Je vous demande de bien vouloir examiner cette situation et de procéder, le cas échéant, au remboursement ou à l'indemnisation qui serait dû au regard des conditions applicables à mon dossier.

Je vous remercie de me confirmer par écrit la suite donnée à cette demande et, si un remboursement est dû, sa date de mise en paiement.

Cordialement,

${name}`;
  if(item.analysisCode==="ECO_LATE_REFUND"){
    subject="Demande de remboursement — dossier "+(ref||"commande");
    body=`Madame, Monsieur,

Je vous contacte concernant le remboursement relatif à ma commande ${ref||"mentionnée dans mon dossier"}.

La demande de remboursement a été effectuée, mais la somme concernée n'a pas été reçue dans le délai attendu.

Je vous demande donc de procéder à la régularisation de ce remboursement et de me confirmer par écrit la date de mise en paiement.

Montant concerné : ${amount ? amount+" €" : "à confirmer"}.

Cordialement,

${name}`;
  }
  if(/^TRAIN_DELAY/.test(item.analysisCode||"")){
    subject="Demande d'indemnisation — retard de train";
    body=`Madame, Monsieur,

Je sollicite l'examen de mon droit à indemnisation à la suite du retard du train concerné par mon dossier.

Référence / billet : ${ref||"à compléter"}.
Retard indiqué dans mon dossier : à confirmer avec le justificatif.
Montant du billet : ${amount ? amount+" €" : "à compléter"}.

Merci de vérifier mon éligibilité et, si les conditions sont réunies, de procéder au versement de l'indemnisation correspondante.

Cordialement,

${name}`;
  }
  if(item.analysisCode==="AIR_EU261_DISTANCE"){
    subject="Demande d'indemnisation — vol retardé / annulé";
    body=`Madame, Monsieur,

Je sollicite l'examen de mon droit à indemnisation concernant le vol indiqué dans mon dossier.

Référence de réservation : ${ref||"à compléter"}.
La situation et la durée exacte du retard doivent être vérifiées à partir des justificatifs joints.

Merci de vérifier mon éligibilité au titre des règles applicables aux passagers aériens et, si les conditions sont réunies, de procéder au versement de l'indemnisation correspondante.

Cordialement,

${name}`;
  }
  return {subject, body, estimatedRecovery:est, generatedAt:new Date().toISOString()};
}
