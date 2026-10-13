import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const home=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const cashback=readFileSync(new URL("../cashback/index.html",import.meta.url),"utf8");

test("public home page does not promise unavailable cashback",()=>{
  assert.match(home,/CASHBACK — EN PRÉPARATION/);
  assert.match(home,/Aucun cashback n’est actuellement garanti/);
  assert.doesNotMatch(home,/NOUVEAU — CASHBACK/);
  assert.doesNotMatch(home,/Voir les offres cashback/);
});

test("cashback page stays closed until provider and payout validation",()=>{
  assert.match(cashback,/Le cashback n’est pas encore ouvert/);
  assert.match(cashback,/aucun versement client n’est disponible/);
  assert.doesNotMatch(cashback,/Activer le cashback/);
  assert.doesNotMatch(cashback,/Achète\. Récupère\. Cumule\./);
});
