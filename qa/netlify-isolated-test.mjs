import { strict as assert } from "node:assert";

const expectedHost = "deploy-preview-22--jade-pegasus-f6e204.netlify.app";
const baseUrl = (process.env.RECUPERE_PREVIEW_URL || `https://${expectedHost}`).replace(/\/$/, "");
const adminKey = String(process.env.RECUPERE_ADMIN_KEY || "");
const sendEmail = process.argv.includes("--send-email");

let parsed;
try { parsed = new URL(baseUrl); } catch { throw new Error("RECUPERE_PREVIEW_URL n'est pas une URL valide."); }
if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost || parsed.pathname !== "/" || parsed.search || parsed.hash) {
  throw new Error(`Arrêt de sécurité : cible autorisée uniquement https://${expectedHost}/`);
}
if (!adminKey) throw new Error("RECUPERE_ADMIN_KEY doit être fourni dans l'environnement du terminal, jamais dans un fichier.");
if (adminKey.length < 16) throw new Error("La clé administrateur semble trop courte ; arrêt par sécurité.");

async function postAction(action, extra = {}) {
  const res = await fetch(`${baseUrl}/api/cases`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ action, ...extra })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Action ${action} refusée (HTTP ${res.status}). Détails : ${String(data.error || "réponse invalide").slice(0, 180)}`);
  return data;
}

console.log("Cible autorisée :", parsed.origin);
console.log("Mode :", sendEmail ? "persistance + e-mail de test explicite" : "persistance uniquement, sans e-mail");
const created = await postAction("create_test");
assert.equal(created.ok, true, "la création du dossier test doit être confirmée");
assert.equal(created.emailSent, false, "la création technique ne doit pas envoyer d'e-mail");
const caseNumber = String(created.case?.caseNumber || "");
assert.match(caseNumber, /^TEST-\d{4}-[A-F0-9]{6}$/, "référence de test inattendue");
console.log("Dossier technique créé :", caseNumber);

const verified = await postAction("verify_test", { caseNumber });
assert.equal(verified.ok, true);
assert.equal(verified.persisted, true, "le dossier doit être relu depuis le magasin de test");
assert.equal(verified.supplierSent, false);
assert.equal(verified.emailSent, false);
console.log("Persistance confirmée :", verified.persisted);
console.log("E-mail envoyé pendant la vérification :", verified.emailSent);
console.log("Envoi fournisseur :", verified.supplierSent);

if (sendEmail) {
  const email = await postAction("send_test_email", { caseNumber });
  assert.equal(email.supplierSent, false);
  assert.equal(email.customerStoreTouched, false);
  console.log("Le prestataire a accepté l'e-mail :", email.emailSent === true);
  console.log("Réception dans la boîte vérifiée par l'API :", email.inboxReceiptVerified === true);
  console.log("IMPORTANT : vérifiez vous-même la boîte de test. Une acceptation du prestataire n'est pas une preuve de réception.");
} else {
  console.log("Étape e-mail ignorée. Pour l'activer volontairement, relancez avec --send-email après avoir vérifié la configuration côté Netlify.");
}
