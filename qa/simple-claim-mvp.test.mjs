import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../simple/index.html", import.meta.url), "utf8");

test("simple claim MVP is a standalone French page with accessible form controls", () => {
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /id="claim-form"/);
  assert.match(html, /id="company"[^>]*required/);
  assert.match(html, /id="category"[^>]*required/);
  assert.match(html, /id="details"[^>]*required/);
  assert.match(html, /aria-live="polite"/);
});

test("simple claim MVP generates a draft locally and offers copy/download", () => {
  assert.match(html, /form\.addEventListener\("submit"/);
  assert.match(html, /actions\.classList\.remove\("hidden"\);status\.textContent="Courrier préparé dans votre navigateur\. Vérifiez chaque information avant de l’utiliser\.";showNextStep\(\);/);
  assert.match(html, /navigator\.clipboard\.writeText\(letter\.value\)/);
  assert.match(html, /letter\.focus\(\);letter\.select\(\)/);
  assert.match(html, /Texte sélectionné : copiez-le/);
  assert.ok(html.includes("Courrier copié."));
  assert.match(html, /id="copy"[^>]*>Copier le courrier/);
  assert.match(html, /id="next-step-wrap" class="actions hidden"/);
  assert.match(html, /Poursuivre ma demande de remboursement/);
  assert.match(html, /function showNextStep\(\)/);
  assert.match(html, /Étape suivante : copiez ou téléchargez votre courrier/);
  assert.match(html, /category==="refund"&&/);
  assert.match(html, /https:\/\/www\.sncf-connect\.com\/aide\/contact/);
  assert.match(html, /https:\/\/www\.fnac\.com\/aide\?thematic=les-retours-and-remboursements/);
  assert.match(html, /Vous devrez finaliser et envoyer votre demande vous-même/);
  assert.match(html, /id="download"[^>]*>Télécharger en \.txt/);
  assert.match(html, /id="letter" class="output hidden" aria-label="Courrier de réclamation généré" spellcheck="true"><\/textarea>/);
  assert.doesNotMatch(html.match(/<textarea id="letter"[\s\S]*?<\/textarea>/)?.[0] || "", /\breadonly\b/);
  assert.match(html, /new Blob\(\[letter\.value\]/);
  assert.match(html, /Aucun courrier n’est envoyé automatiquement/);
});

test("simple claim MVP does not submit or persist user-provided form data", () => {
  assert.doesNotMatch(html, /<form[^>]+action=/i);
  assert.doesNotMatch(html, /fetch\s*\(/i);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(html, /netlify\.functions|stripe|RESEND_API_KEY/i);
});

test("simple claim MVP sets reasonable input length and amount limits", () => {
  assert.match(html, /name="company" maxlength="120"/);
  assert.match(html, /name="details" maxlength="3000"/);
  assert.match(html, /name="amount" type="number" min="0" max="10000000"/);
});

test("generated letters use corrected, category-specific French wording", () => {
  assert.match(html, /const subjects=\{refund:"Demande de remboursement non reçu"/);
  assert.match(html, /refund:"Je vous contacte au sujet d’un remboursement que je n’ai pas encore reçu\."/);
  assert.match(html, /delivery:"Je vous contacte au sujet d’une commande ou d’un colis qui ne m’a pas été livré\."/);
  assert.match(html, /defect:"Je vous contacte au sujet d’un produit défectueux ou d’une question relative à la garantie\."/);
  assert.match(html, /transport:"Je vous contacte au sujet d’un retard ou d’une annulation de transport\."/);
  assert.match(html, /billing:"Je vous contacte afin de contester une facturation\."/);
  assert.doesNotMatch(html, /Je vous contacte au sujet de \+labels\[category\]/);
  assert.match(html, /Voici les faits tels que je les ai constatés/);
  assert.match(html, /details\.localeCompare\(opening, "fr", \{sensitivity:"base"\}\)===0/);
  assert.match(html, /Votre description reprend la phrase d’introduction/);
  assert.match(html, /const refundAfterReturn=category==="refund"/);
  assert.match(html, /Mon colis ayant été renvoyé, je reste dans l’attente du remboursement du montant indiqué ci-dessus/);
  assert.match(html, /vérifier la bonne réception et la prise en compte du retour/);
  assert.match(html, /date prévue du remboursement/);
  assert.match(html, /const request=category==="refund"/);
});
