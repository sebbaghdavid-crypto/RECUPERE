# Runbook — validation isolée Netlify pour RÉCUPÈRE

## Objectif et garde-fous

Ce protocole valide la persistance du magasin technique, puis (sur décision explicite) l'envoi d'un seul e-mail de test. Il ne valide pas la production et ne doit jamais être exécuté sur le site de production.

- Cible autorisée : aperçu de la PR #22 uniquement.
- Aucun dossier client ne doit être créé.
- Aucun e-mail client ou fournisseur ne doit être envoyé.
- Ne jamais mettre la clé administrateur dans un fichier, une URL, un ticket ou une capture.
- Ne pas modifier les variables Netlify ni activer une dépense pour faire passer le test.
- Si l'aperçu ne correspond pas au commit attendu, arrêter : ne pas contourner Edge Access et ne pas envoyer de requête à une autre URL.

## Pré-requis

1. Le déploiement d'aperçu de la PR #22 doit être à jour et accessible.
2. Les variables serveur `RECUPERE_ADMIN_KEY`, `RESEND_API_KEY`, `RESEND_FROM` doivent être déjà configurées pour cet aperçu.
3. Pour l'e-mail, `RECUPERE_TEST_EMAIL` doit être configurée côté Netlify avec une boîte de test contrôlée. Ne pas remplacer cette variable par une adresse transmise par le navigateur.
4. Ne pas poursuivre si l'une des variables manque ou si l'adresse de test n'est pas maîtrisée.

## Étape A — Persistance, sans e-mail

Utiliser le script `qa/netlify-isolated-test.mjs` depuis un terminal Node.js 22+. Définir `RECUPERE_ADMIN_KEY` dans l'environnement du terminal sans la coller dans le code. Le script est limité à l'URL exacte de l'aperçu PR #22.

```bash
RECUPERE_ADMIN_KEY='(clé admin fournie localement)' node qa/netlify-isolated-test.mjs
```

Le script crée un seul dossier technique, puis relit la référence retournée. Résultat attendu : création HTTP 201, puis `persisted: true`. Il ne lance pas d'e-mail par défaut.

## Étape B — E-mail de test, uniquement après réussite de l'étape A

Après avoir vérifié les variables et la boîte de test côté Netlify, lancer explicitement :

```bash
RECUPERE_ADMIN_KEY='(clé admin fournie localement)' node qa/netlify-isolated-test.mjs --send-email
```

Le script crée un nouveau dossier technique et demande au serveur d'envoyer un message avec un objet préfixé `[TEST RÉCUPÈRE]`. Vérifier ensuite la boîte de réception et les courriers indésirables. Le résultat de l'API indique seulement si le prestataire a accepté le message ; il ne prouve pas la réception.

## Résultats à consigner

- Horodatage et commit de l'aperçu.
- Référence `TEST-...` (ne pas publier de clé ni de jeton).
- Résultat de la relecture du stockage.
- Pour l'e-mail : réponse du prestataire puis preuve séparée de réception dans la boîte.
- Vérification que le magasin et l'index client n'ont pas changé et qu'aucun fournisseur n'a été contacté.

## Arrêt immédiat si

- L'aperçu est bloqué, obsolète ou ne correspond pas au commit attendu.
- La clé administrateur ou le stockage n'est pas configuré.
- Le serveur retourne une erreur inattendue.
- L'adresse de test n'est pas confirmée.
- Le résultat suggère une écriture dans le magasin client.

Ne jamais contourner l'accès de prévisualisation, fusionner la PR, déployer en production ou payer pour débloquer ce protocole.
