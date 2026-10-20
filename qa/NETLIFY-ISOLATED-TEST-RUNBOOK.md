# Runbook — validation isolée Netlify pour RÉCUPÈRE

> Mise à jour après fusion de la PR #22 : l'aperçu historique sert uniquement à la validation technique. L'URL de production a retourné 404 sur `/simple/` après fusion lors du contrôle en lecture seule. Ne pas lancer de POST de test tant que l'aperçu n'est pas prouvé frais et que les variables d'environnement n'ont pas été confirmées.

## Objectif et garde-fous

Ce protocole valide la persistance du magasin technique, puis (sur décision explicite) l'envoi d'un seul e-mail de test. Il ne valide pas la production et ne doit jamais être exécuté sur le site de production.

- Cible autorisée : aperçu de la PR #22 uniquement, et seulement si sa publication est prouvée correspondre au code testé.
- Aucun dossier client ne doit être créé.
- Aucun e-mail client ou fournisseur ne doit être envoyé.
- Ne jamais mettre la clé administrateur dans un fichier, une URL, un ticket ou une capture.
- Ne pas modifier les variables Netlify ni activer une dépense pour faire passer le test.
- Si l'aperçu ne correspond pas au commit attendu, arrêter : ne pas contourner Edge Access et ne pas envoyer de requête à une autre URL.

## Pré-requis

1. Le déploiement d'aperçu doit être à jour et accessible. Le site de production a répondu 404 sur `/simple/` après fusion ; ne pas confondre l'accessibilité de l'API avec celle de la nouvelle page.
2. Les variables serveur `RECUPERE_ADMIN_KEY`, `RESEND_API_KEY`, `RESEND_FROM` doivent être déjà configurées pour cet aperçu.
3. Pour l'e-mail, `RECUPERE_TEST_EMAIL` doit être configurée côté Netlify avec une boîte de test contrôlée. Ne pas remplacer cette variable par une adresse transmise par le navigateur.
4. Ne pas poursuivre si l'une des variables manque ou si l'adresse de test n'est pas maîtrisée.

## Étape A — Persistance, sans e-mail

**État actuel : BLOQUÉ pour exécution automatique sans opérateur.** Aucun accès aux variables secrètes Netlify n'est exposé à ce runbook et aucune clé administrateur n'est disponible dans l'environnement d'exécution de l'agent. Ne pas envoyer de POST tant que ces prérequis ne sont pas vérifiés.

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

Ne jamais contourner l'accès de prévisualisation, fusionner une autre PR, déployer en production ou payer pour débloquer ce protocole.

## Diagnostic du 404 sur /simple (20 octobre 2026)

Le contrôle en lecture seule de la production a donné 404 sur les trois URL suivantes : `/simple`, `/simple/` et `/simple/index.html`. Comme le fichier source `simple/index.html` existe dans le dépôt et que les redirections sont présentes dans `netlify.toml`, ce résultat indique que le fichier n'est pas présent dans l'artefact actuellement servi par Netlify (déploiement obsolète ou répertoire publié différent), plutôt qu'un simple problème de barre oblique dans l'URL. La correction configure un build dédié vers `dist/`, copie explicitement `simple/index.html` dans cet artefact et garde les deux redirections. Après un déploiement gratuit réussi, vérifier dans cet ordre : `/simple/index.html`, `/simple`, `/simple/`. Tant que le déploiement n'a pas eu lieu, ne pas annoncer le 404 comme corrigé.
