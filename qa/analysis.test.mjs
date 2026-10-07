import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCase } from "../netlify/functions/analysis.mjs";

test("e-commerce late refund produces a strong opportunity",()=>{
 const r=analyzeCase({category:"e-commerce",description:"Le remboursement est en retard depuis plusieurs jours",amount:"129.90"});
 assert.equal(r.opportunityLevel,"STRONG");
 assert.equal(r.estimatedRecovery,129.90);
 assert.equal(r.analysisCode,"ECO_LATE_REFUND");
});

test("train delay over two hours calculates 50 percent",()=>{
 const r=analyzeCase({category:"train",description:"TGV retardé de 2h30",amount:"80"});
 assert.equal(r.opportunityLevel,"STRONG");
 assert.equal(r.estimatedRecovery,40);
 assert.equal(r.analysisCode,"TRAIN_DELAY_50");
});

test("train delay with separate hours and minutes is parsed",()=>{
 const r=analyzeCase({category:"train",description:"TGV retardé de 2 heures 30 minutes",amount:"80"});
 assert.equal(r.estimatedRecovery,40);
 assert.equal(r.analysisCode,"TRAIN_DELAY_50");
});

test("train delay in minutes is parsed",()=>{
 const r=analyzeCase({category:"train",description:"TGV retardé de 90 minutes",amount:"80"});
 assert.equal(r.estimatedRecovery,20);
 assert.equal(r.analysisCode,"TRAIN_DELAY_25");
});

test("air compensation remains verification only",()=>{
 const r=analyzeCase({category:"vol",description:"Vol annulé, distance 2200 km",amount:"300"});
 assert.equal(r.opportunityLevel,"VERIFY");
 assert.equal(r.estimatedRecovery,null);
 assert.equal(r.analysisCode,"AIR_EU261_DISTANCE");
});

test("unpaid rental deposit is detected without promising payment",()=>{
 const r=analyzeCase({category:"location",description:"Dépôt de garantie non rendu après remise des clés",amount:"900"});
 assert.equal(r.opportunityLevel,"VERIFY");
 assert.equal(r.analysisCode,"RENT_DEPOSIT");
});

test("unknown case does not invent recovery",()=>{
 const r=analyzeCase({category:"autre",description:"Je pense avoir peut-être un problème",amount:"500"});
 assert.equal(r.opportunityLevel,"NONE");
 assert.equal(r.estimatedRecovery,null);
});


test("chargeback is explicit and remains verification only",()=>{
 const r=analyzeCase({category:"chargeback",description:"Je veux contester un paiement carte non autorisé",amount:"300"});
 assert.equal(r.opportunityLevel,"VERIFY");
 assert.equal(r.analysisCode,"CHARGEBACK");
 assert.equal(r.estimatedRecovery,null);
});

test("verification families never expose a recovery estimate",()=>{
 const cases=[
  ["commande","colis jamais reçu"],
  ["produit défectueux","produit cassé sous garantie"],
  ["rappel produit","produit dangereux rappelé"],
  ["bagage","bagage perdu"],
  ["télécom","augmentation du tarif"],
  ["énergie","trop perçu"],
  ["logement","charges trop perçues"],
  ["mutuelle","remboursement manquant"],
  ["impôt","trop payé"],
  ["assurance","sinistre non indemnisé"],
  ["billet avion","billet inutilisé taxes"]
 ];
 for(const [category,description] of cases){
  const r=analyzeCase({category,description,amount:"999"});
  assert.equal(r.opportunityLevel,"VERIFY",category);
  assert.equal(r.estimatedRecovery,null,category);
 }
});
