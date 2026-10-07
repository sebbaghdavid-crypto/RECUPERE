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
- **RESEND_API_KEY** — clé API Resend pour les emails transactionnels
- **RESEND_FROM** — adresse expéditrice vérifiée dans Resend

Cette clé sert à protéger `/admin/`. Elle ne doit jamais être committée dans GitHub.

## URLs

- Site : https://jade-pegasus-f6e204.netlify.app/
- Administration : https://jade-pegasus-f6e204.netlify.app/admin/
- Portail client : https://jade-pegasus-f6e204.netlify.app/portal/

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


## Cashback autonome

RÉCUPÈRE dispose maintenant d'un moteur cashback prêt à connecter à un réseau d'affiliation :
- catalogue d'offres via `RECUPERE_CASHBACK_OFFERS`
- génération de liens Awin via `AWIN_API_TOKEN` + `AWIN_PUBLISHER_ID`
- clickref unique pour rattacher une vente à un utilisateur
- webhook `/api/cashback-webhook` pour recevoir les transactions
- portefeuille `/api/cashback-wallet?email=...`
- synchronisation quotidienne des statuts de transactions
- part reversée configurable via `RECUPERE_CASHBACK_SHARE` (défaut 80 % de la commission)
- seuil indicatif de paiement via `RECUPERE_MIN_PAYOUT` (défaut 10 €)

### Variables supplémentaires

`AWIN_API_TOKEN`, `AWIN_PUBLISHER_ID`, `RECUPERE_CASHBACK_OFFERS`, `RECUPERE_CASHBACK_SHARE`, `RECUPERE_MIN_PAYOUT`.

Le callback Awin à configurer est `https://jade-pegasus-f6e204.netlify.app/api/cashback-webhook`. Le taux affiché côté utilisateur doit provenir d'un programme partenaire réellement actif : aucune commission ou récupération n'est garantie avant validation du réseau.
