# RÉCUPÈRE

**Je cherche l'argent que vous avez oublié de réclamer.**

RÉCUPÈRE est un service français de détection, préparation et suivi de démarches de remboursement, réclamation ou indemnisation.

## Ce qui fonctionne dans cette V1

- landing publique
- dépôt de dossier ; les justificatifs sont temporairement désactivés pour protéger les données personnelles
- création persistante d'un numéro de dossier
- code privé de suivi
- suivi client
- administration des dossiers
- intégration Stripe Checkout présente dans le code, mais désactivée par défaut
- garde-fou de paiement : activation explicite, clé `sk_test_` obligatoire et Price ID explicitement configuré
- confirmation de paiement par webhook Stripe côté serveur lorsque le parcours est configuré en sandbox
- recherche et filtres
- changement de statut
- historique des événements
- stockage persistant via Netlify Blobs

## Déploiement

Le dépôt est connecté à Netlify : les pushes sur `main` déclenchent les déploiements de production.

## Configuration indispensable

Créer dans Netlify ces variables d'environnement, disponibles pour les Functions :

- **RECUPERE_ADMIN_KEY** — clé secrète de l'administration
- **RECUPERE_PAYMENTS_ENABLED** — absent ou `false` par défaut ; ne mettre `true` que pour un test approuvé
- **STRIPE_SECRET_KEY** — pour les tests uniquement, clé Stripe `sk_test_`; les clés live sont refusées par la garde actuelle
- **STRIPE_WEBHOOK_SECRET** — secret du webhook de test correspondant à la configuration sandbox
- **RECUPERE_STRIPE_PRICE_ID** — Price ID créé dans le même environnement de test ; aucun Price ID live codé en dur
- **RECUPERE_BASE_URL** — `https://jade-pegasus-f6e204.netlify.app`
- **RESEND_API_KEY** — clé API Resend pour les emails transactionnels
- **RESEND_FROM** — adresse expéditrice vérifiée dans Resend

Cette clé sert à protéger `/admin/`. Elle ne doit jamais être committée dans GitHub. Le paiement reste désactivé tant que la variable de garde n’est pas explicitement activée avec une configuration Stripe de test valide.

## URLs

- Site : https://jade-pegasus-f6e204.netlify.app/
- Administration : https://jade-pegasus-f6e204.netlify.app/admin/
- Portail client : https://jade-pegasus-f6e204.netlify.app/portal/

## Architecture

- HTML/CSS/JS statique pour l'interface
- Netlify Functions pour l'API
- Netlify Blobs pour la persistance
- Netlify Functions et Netlify Blobs pour les dossiers ; les justificatifs restent désactivés jusqu’à validation d’un stockage privé

## Prochaines briques

1. emails transactionnels
2. authentification client
3. référentiel vérifié des fournisseurs et démarches, avec sources et dates de contrôle
4. moteur d'identification fournisseur à partir des numéros de commande/facture et autres indices, avec niveau de confiance explicable
5. analyse d'éligibilité par catégorie et préparation de réclamations sourcées
6. OCR sécurisé des justificatifs, uniquement après mise en place d'un stockage privé audité
7. relances automatiques soumises aux règles et au consentement de l'utilisateur
8. pilote utilisateurs réels avec mesure des faux positifs

La spécification du moteur d'identification IA est documentée dans AI_PROVIDER_ROUTING_SPEC.md. Le référentiel public peut aider à vérifier l'identité légale d'une entreprise, mais ne suffit pas à retrouver un fournisseur à partir d'un numéro de commande isolé.


## Cashback — non ouvert au public

Le cashback est en préparation et n'est pas disponible pour les utilisateurs. Les pages publiques ne doivent pas promettre de gains ou de versements. Le webhook AWIN reste désactivé tant qu'une authentification compatible n'a pas été validée. Les versements clients ne sont pas implémentés.

Les variables et fonctions cashback présentes dans le dépôt sont des éléments de développement, pas une offre active. La mise en service exige validation réelle de Capitis, du réseau d'affiliation, du suivi des conversions, de la devise et du processus de paiement. Aucun solde ne doit être présenté comme un virement effectué.

## Documents de lancement

- PRODUCTION_READINESS.md — contrôles techniques, manuels, sécurité, fournisseurs et pilote.
- LEGAL_CONTENT_DRAFT.md — informations juridiques à compléter et faire vérifier ; document non publiable tel quel.
