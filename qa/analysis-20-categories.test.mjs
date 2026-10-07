import test from "node:test";
import assert from "node:assert/strict";
import {analyzeCase} from "../netlify/functions/analysis.mjs";

const cases=[
 ["e-commerce","le remboursement est en retard","ECO_LATE_REFUND"],
 ["colis","colis jamais reçu","ECO_UNDELIVERED"],
 ["chargeback","contester un paiement carte non autorisé","CHARGEBACK"],
 ["rétractation","je demande ma rétractation dans les 14 jours","ECO_WITHDRAWAL"],
 ["produit défectueux","produit cassé sous garantie","PRODUCT_GUARANTEE"],
 ["rappel produit","produit dangereux faisant l'objet d'un rappel","PRODUCT_RECALL"],
 ["vol","vol annulé distance 2200 km","AIR_EU261_DISTANCE"],
 ["bagage","bagage perdu avec frais","AIR_BAGGAGE"],
 ["train","TGV retardé de 90 minutes","TRAIN_DELAY_25"],
 ["portabilité","retard de portabilité du numéro","MOBILE_PORTING"],
 ["télécom","augmentation du tarif de mon abonnement","TELECOM_PRICE"],
 ["énergie","trop perçu sur ma facture","ENERGY_OVERPAYMENT"],
 ["énergie","facture anormalement élevée, compteur","ENERGY_BILL"],
 ["location","dépôt de garantie non rendu","RENT_DEPOSIT"],
 ["charges locatives","régularisation avec trop perçu","RENT_CHARGES"],
 ["mutuelle","remboursement de soins manquant","HEALTH_MISSING"],
 ["impôt","trop payé, crédit à rembourser","TAX_OVERPAYMENT"],
 ["banque","prélèvement inconnu à contester","BANK_DEBIT"],
 ["assurance","sinistre non indemnisé","INSURANCE_CLAIM"],
 ["billet avion","billet inutilisé, je demande les taxes","AIR_UNUSED_TICKET"]
];

for(const [category,description,code] of cases){
 test(code,()=>{
  const r=analyzeCase({category,description,amount:"100"});
  assert.equal(r.analysisCode,code);
  assert.equal(r.opportunityLevel,code.startsWith("ECO_LATE")||code.startsWith("TRAIN_DELAY")?"STRONG":"VERIFY");
  if(r.opportunityLevel==="VERIFY")assert.equal(r.estimatedRecovery,null);
 });
}
