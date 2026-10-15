import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

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

const portal=readFileSync(new URL("../portal/index.html",import.meta.url),"utf8");

test("customer portal inline JavaScript stays syntactically valid",()=>{
  const scripts=[...portal.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(script=>script.trim());
  assert.ok(scripts.length>0,"portal should contain an inline script");
  for(const [index,script] of scripts.entries()){
    assert.doesNotThrow(()=>new Script(script,{filename:"portal-inline-"+index+".js"}));
  }
});

test("portal magic-link request sends JSON headers and handles network errors",()=>{
  assert.ok(portal.includes('headers:{"content-type":"application/json"}'));
  assert.ok(portal.includes("Connexion momentanément indisponible"));
  assert.ok(portal.includes("finally{button.disabled=false"));
});
