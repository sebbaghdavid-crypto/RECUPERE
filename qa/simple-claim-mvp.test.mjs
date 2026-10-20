import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../simple/index.html", import.meta.url), "utf8");

test("simple claim MVP is a standalone French page with accessible form controls", () => {
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /id="claim-form"/);
  assert.match(html, /id="company"[^>]*required/);
  assert.match(html, /id="category"[^>]*required/);
  assert.match(html, /id="details"[^>]*required/);
  assert.match(html, /id="email" name="email" type="email"[^>]*required/);
  assert.match(html, /id="consent" name="consent" type="checkbox"/);
  assert.match(html, /aria-live="polite"/);
});

test("simple claim MVP generates a draft locally and offers copy/download", () => {
  assert.match(html, /form\.addEventListener\("submit"/);
  assert.match(html, /form\.addEventListener\("input",event=>\{if\(event\.target\?\.id===\"consent\"\)return;/, "changing consent must not invalidate the generated draft");
  assert.match(html, /actions\.classList\.remove\("hidden"\);reviewSubmitWrap\.classList\.remove\("hidden"\);reviewSubmitNote\.classList\.remove\("hidden"\);status\.textContent="Courrier préparé\. Vérifiez les informations, puis envoyez le dossier à RÉCUPÈRE si vous souhaitez une étude\.";showNextStep\(\);/);
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
  assert.match(html, /id="review-submit"[^>]*>Envoyer mon dossier en étude à RÉCUPÈRE/);
  assert.match(html, /fetch\("\/api\/cases"/);
  assert.match(html, /claimDraft:letter\.value/);
  assert.match(html, /Dossier reçu par RÉCUPÈRE/);
  assert.match(html, /La réclamation n’a pas été envoyée au fournisseur/);
  assert.match(html, /Transmission du dossier en cours/);
  assert.match(html, /id="letter" class="output hidden" aria-label="Courrier de réclamation généré" spellcheck="true"><\/textarea>/);
  assert.doesNotMatch(html.match(/<textarea id="letter"[\s\S]*?<\/textarea>/)?.[0] || "", /\breadonly\b/);
  assert.match(html, /new Blob\(\[letter\.value\]/);
  assert.match(html, /Aucun courrier n’est envoyé automatiquement/);
});

test("simple claim MVP submits only after explicit consent through the case API", () => {
  assert.match(html, /fetch\("\/api\/cases"/);
  assert.match(html, /consent:true/);
  assert.match(html, /claimDraft:letter\.value/);
  assert.match(html, /Dossier reçu par RÉCUPÈRE/);
  assert.match(html, /La réclamation n’a pas été envoyée au fournisseur/);
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


test("case API stores the generated draft and enforces consent and rate limits", async () => {
  const { readFile } = await import("node:fs/promises");
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  assert.match(api, /claimDraft: clean\(body\.claimDraft, 8000\)/);
  assert.match(api, /if \(!hasConsent\(body\.consent\)\)/);
  assert.match(api, /allowCaseCreate\(email, ip\)/);
});

test("embedded browser JavaScript parses without syntax errors", () => {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "expected an inline script");
  assert.doesNotThrow(() => new vm.Script(match[1]), "inline script must be valid JavaScript");
});

test("customer emails prefer the active preview URL over the production site URL", async () => {
  const notifications = await readFile(new URL("../netlify/functions/notifications.mjs", import.meta.url), "utf8");
  assert.match(notifications, /process\.env\.RECUPERE_BASE_URL\|\|process\.env\.DEPLOY_PRIME_URL\|\|process\.env\.URL/);
  assert.ok(notifications.includes("process.env.DEPLOY_PRIME_URL"));
  assert.ok(notifications.includes("process.env.URL"));
});


test("technical test-case path requires admin authorization and never sends customer email", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  const start = api.indexOf('if (body.action === "create_test")');
  const end = api.indexOf('if (body.action === "prepare_claim")', start);
  assert.ok(start >= 0 && end > start, "expected an isolated create_test branch");
  const testBranch = api.slice(start, end);
  assert.match(testBranch, /allowAdminRequest\(adminIp\)/);
  assert.match(testBranch, /if \(!adminOk\(req\)\)/);
  assert.match(testBranch, /test-interne@example\.invalid/);
  assert.match(testBranch, /isTest: true/);
  assert.doesNotMatch(testBranch, /sendCustomerEmail\(/);
  assert.match(testBranch, /Aucune demande réelle, aucun e-mail envoyé, aucun paiement déclenché/);
});

test("test email action is admin-only, restricted to the configured test inbox, and isolated from customer cases", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  const start = api.indexOf('if (body.action === "send_test_email")');
  const end = api.indexOf('if (body.action === "prepare_claim")', start);
  assert.ok(start >= 0 && end > start, "expected isolated test email action");
  const branch = api.slice(start, end);
  assert.match(branch, /allowAdminRequest\(adminIp\)/);
  assert.match(branch, /if \(!adminOk\(req\)\)/);
  assert.match(branch, /RECUPERE_TEST_EMAIL/);
  assert.match(branch, /testStore\.get/);
  assert.match(branch, /testStore\.setJSON/);
  assert.match(branch, /customerStoreTouched: false/);
  assert.match(branch, /inboxReceiptVerified: false/);
  assert.match(branch, /supplierSent: false/);
  assert.doesNotMatch(branch, /indexCase\(|store\.setJSON\(|action === "status"/);
});

test("case creation stores the dossier before email and returns email status without exposing access token", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  const storeAt = api.indexOf("await store.setJSON(`case/\u0024{token}`, item);");
  const emailAt = api.indexOf("const emailResult = await sendCustomerEmail", storeAt);
  const responseAt = api.indexOf("return response({ ok: true, caseNumber, status: item.status", emailAt);
  assert.ok(storeAt >= 0 && emailAt > storeAt && responseAt > emailAt, "expected storage before email and final receipt");
  assert.match(api, /emailSent: emailResult\.sent/);
  assert.match(api, /CUSTOMER_EMAIL_FAILED/);
  assert.match(api, /const \{ accessToken, \.\.\.safe \} = item/);
  assert.match(api, /return response\(safe\)/);
});

test("customer submission requires consent and applies server-side rate limiting before storage", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  const consentAt = api.indexOf("if (!hasConsent(body.consent))");
  const rateLimitAt = api.indexOf("allowCaseCreate(email, ip)", consentAt);
  const storeAt = api.indexOf("await store.setJSON(`case/\u0024{token}`, item);", rateLimitAt);
  assert.ok(consentAt >= 0 && rateLimitAt > consentAt && storeAt > rateLimitAt);
  assert.match(api, /if \(!name \|\| !email \|\| !email\.includes\("@"\)\)/);
  assert.match(api, /if \(!hasConsent\(body\.consent\)\) return response\(\{ error:/);
});

test("technical test dossiers use a separate store and do not enter customer indexing", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  assert.ok(api.includes('name: "recupere-cases-test"'));
  const start = api.indexOf('if (body.action === "create_test")');
  const end = api.indexOf('if (body.action === "verify_test")', start);
  assert.ok(start >= 0 && end > start);
  const branch = api.slice(start, end);
  assert.ok(branch.includes("testStore.setJSON"));
  assert.equal(branch.includes("store.setJSON("), false);
  assert.equal(branch.includes("indexCase("), false);
  assert.equal(branch.includes("sendCustomerEmail("), false);
  assert.ok(branch.includes("emailSent: false"));
  assert.ok(branch.includes("isTest: true"));
});

test("technical test persistence verification is admin-protected and confirms no email or supplier submission", async () => {
  const api = await readFile(new URL("../netlify/functions/cases.mjs", import.meta.url), "utf8");
  const start = api.indexOf('if (body.action === "verify_test")');
  const end = api.indexOf('if (body.action === "prepare_claim")', start);
  assert.ok(start >= 0 && end > start);
  const branch = api.slice(start, end);
  assert.ok(branch.includes("allowAdminRequest(adminIp)"));
  assert.ok(branch.includes("adminOk(req)"));
  assert.ok(branch.includes("testStore.get"));
  assert.ok(branch.includes("persisted: true, emailSent: false, supplierSent: false"));
  assert.ok(branch.includes("TEST-"));
});
