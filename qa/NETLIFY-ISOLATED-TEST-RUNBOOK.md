# Runbook — validation isolée Netlify pour RÉCUPÈRE

> Version alignée sur la PR #27 (« Fix production /simple 404 and secure Netlify publish »). La PR reste ouverte et non fusionnée. La production a répondu 404 sur `/simple`, `/simple/` et `/simple/index.html` lors du dernier contrôle. Ne pas lancer de POST tant que l’aperçu n’est pas prouvé à jour, accessible et associé au commit attendu, et que les variables d’environnement n’ont pas été confirmées.

## Objectif et garde-fous

Ce protocole valide la persistance du magasin technique, puis, sur décision explicite, l’envoi d’un seul e-mail de test. Il ne valide pas la production et ne doit jamais être exécuté sur le site de production.

- Cible autorisée : aperçu de la PR #27 uniquement : `https://deploy-preview-27--jade-pegasus-f6e204.netlify.app/`, et seulement si sa publication correspond au commit attendu.
- Aucun dossier client ne doit être créé.
- Aucun e-mail client ou fournisseur ne doit être envoyé.
- Ne jamais mettre la clé administrateur dans un fichier, une URL, un ticket ou une capture.
- Ne pas modifier les variables Netlify ni activer une dépense pour faire passer le test.
- Si l’aperçu est bloqué par Edge Access, obsolète ou ne correspond pas au commit attendu, arrêter. Ne pas contourner Edge Access et ne pas envoyer de requête à une autre URL.

## Pré-requis

1. Vérifier dans GitHub que la PR #27 est toujours ouverte et que les contrôles automatiques sont verts.
2. Vérifier dans Netlify/GitHub que l’aperçu #27 correspond bien au commit de la branche testé. L’URL seule ne prouve pas la fraîcheur du déploiement.
3. L’aperçu doit être accessible. Si Edge Access bloque l’accès, le test est BLOQUÉ et aucune requête ne doit être envoyée.
4. Les variables serveur `RECUPERE_ADMIN_KEY`, `RESEND_API_KEY` et `RESEND_FROM` doivent déjà être configurées pour cet aperçu.
5. Pour l’e-mail, `RECUPERE_TEST_EMAIL` doit être configurée côté Netlify avec une boîte de test contrôlée. Ne pas remplacer cette variable par une adresse transmise par le navigateur.
6. Ne pas poursuivre si une variable manque ou si l’adresse de test n’est pas maîtrisée.

## Étape A — Persistance, sans e-mail

**État : BLOQUÉ tant que l’aperçu #27 et sa configuration ne sont pas vérifiés.** L’agent ne dispose pas des variables secrètes Netlify ni d’une clé administrateur. Aucun POST ne doit être lancé avant vérification locale des prérequis.

Utiliser `qa/netlify-isolated-test.mjs` depuis un terminal Node.js 22+. Définir `RECUPERE_ADMIN_KEY` dans l’environnement du terminal, sans la coller dans le code ou dans le chat.

```bash
RECUPERE_ADMIN_KEY='(clé admin fournie localement)' node qa/netlify-isolated-test.mjs
```

Le script est verrouillé sur l’hôte exact de l’aperçu de la PR #27. Il crée un dossier technique, puis relit la référence retournée. Résultat attendu : création confirmée et `persisted: true`. Aucun e-mail n’est demandé par défaut.

## Étape B — E-mail de test, uniquement après réussite de l’étape A

Après vérification des variables et de la boîte de test côté Netlify, lancer explicitement :

```bash
RECUPERE_ADMIN_KEY='(clé admin fournie localement)' node qa/netlify-isolated-test.mjs --send-email
```

Le script crée un nouveau dossier technique et demande au serveur d’envoyer un message de test. Vérifier ensuite la boîte de réception et les courriers indésirables. L’acceptation par le prestataire ne prouve pas la réception effective.

## Résultats à consigner

- Horodatage et commit de l’aperçu #27.
- Référence `TEST-...` (ne jamais publier de clé ni de jeton).
- Résultat de la relecture du stockage.
- Pour l’e-mail : réponse du prestataire puis preuve distincte de réception dans la boîte.
- Confirmation qu’aucun fournisseur n’a été contacté et que le magasin client n’a pas été modifié.

## Arrêt immédiat si

- L’aperçu est bloqué, obsolète ou ne correspond pas au commit attendu.
- La clé administrateur ou le stockage n’est pas configuré.
- Le serveur retourne une erreur inattendue.
- L’adresse de test n’est pas confirmée.
- Le résultat suggère une écriture dans le magasin client.

Ne jamais contourner l’accès de prévisualisation, fusionner la PR, déployer en production ou payer pour débloquer ce protocole.

## Diagnostic du 404 sur /simple

Le dernier contrôle en lecture seule de la production a donné 404 sur `/simple`, `/simple/` et `/simple/index.html`. La PR #27 prépare un build dédié vers `dist/`, copie explicitement `simple/index.html` dans cet artefact et garde les deux redirections. Après un déploiement autorisé et réussi, vérifier dans cet ordre : `/simple/index.html`, `/simple`, `/simple/`. Tant que le déploiement n’a pas eu lieu, ne pas annoncer le 404 comme corrigé.
