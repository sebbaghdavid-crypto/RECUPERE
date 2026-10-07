# RÉCUPÈRE

**Je cherche l'argent que vous avez oublié de réclamer.**

RÉCUPÈRE est un service français de détection, préparation et suivi de démarches de remboursement, réclamation ou indemnisation.

## Ce qui fonctionne dans cette V1

- landing publique
- dépôt de dossier avec justificatif
- création persistante d'un numéro de dossier
- code privé de suivi
- suivi client
- administration des dossiers
- paiement Stripe Checkout à 9,90 € par dossier
- confirmation de paiement par webhook Stripe côté serveur
- facture Stripe créée lors du Checkout
- recherche et filtres
- changement de statut
- historique des événements
- stockage persistant via Netlify Blobs

## Déploiement

Le dépôt est connecté à Netlify : les pushes sur `main` déclenchent les déploiements de production.

## Configuration indispensable

Créer dans Netlify ces variables d'environnement, disponibles pour les Functions :

- **RECUPERE_ADMIN_KEY** — clé secrète de l'administration
- **STRIPE_SECRET_KEY** — clé secrète API Stripe du compte RÉCUPÈRE
- **STRIPE_WEBHOOK_SECRET** — secret du webhook `https://jade-pegasus-f6e204.netlify.app/api/stripe-webhook`
- **RECUPERE_STRIPE_PRICE_ID** — `price_1UNs7PRS9BxXjI4TydRc7JIX`
- **RECUPERE_BASE_URL** — `https://jade-pegasus-f6e204.netlify.app`

Cette clé sert à protéger `/admin/`. Elle ne doit jamais être committée dans GitHub.

## URLs

- Site : https://jade-pegasus-f6e204.netlify.app/
- Administration : https://jade-pegasus-f6e204.netlify.app/admin/

## Architecture

- HTML/CSS/JS statique pour l'interface
- Netlify Functions pour l'API
- Netlify Blobs pour la persistance
- Netlify Forms pour les justificatifs et l'intake

## Prochaines briques

1. emails transactionnels
2. authentification client
3. moteur d'analyse par catégorie
4. préparation des réclamations
5. relances automatiques
6. portail client complet
7. pilote utilisateurs réels
