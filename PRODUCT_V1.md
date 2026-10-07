# RÉCUPÈRE — V1

## État réel au 7 octobre 2026

Le dépôt contient maintenant la landing pilot, un formulaire Netlify avec pièce jointe, une API serverless et un stockage persistant Netlify Blobs.

Le produit n'est **pas encore un SaaS complet** : authentification client, emails transactionnels et moteur d'analyse métier restent à finaliser. Le paiement Stripe Checkout est désormais branché côté produit, avec confirmation serveur par webhook.

## Fonctionnalités désormais codées

### Intake
- formulaire public RÉCUPÈRE
- création d'un dossier persistant
- numéro de dossier REC-AAAA-XXXXXX
- code privé de suivi
- catégories, entreprise, référence, montant, description
- pièce jointe via Netlify Forms
- transmission sans envoi automatique de réclamation

### Suivi client
- espace de suivi sur la page publique
- recherche par code privé
- affichage du statut
- affichage de l'historique des événements
- mémorisation locale du code de suivi sur le navigateur

### Administration
- /admin/
- authentification par clé serveur
- liste des dossiers
- recherche
- filtre par statut
- compteurs
- changement de statut
- note interne
- historique/audit des changements

### Stockage
Netlify Blobs est utilisé comme stockage persistant site-wide. Les dossiers sont enregistrés sous case/<accessToken>.

## Modèle métier

### users
- id
- email
- name
- role: customer | admin
- created_at
- updated_at

### cases
- id
- case_number
- user_id
- category
- company
- reference
- amount
- description
- status
- opportunity_level
- estimated_recovery
- confidence
- created_at
- updated_at

### documents
- id
- case_id
- file_name
- file_url
- mime_type
- created_at

### payments
- id
- case_id
- user_id
- provider
- provider_payment_id
- amount
- currency
- status
- created_at

### invoices
- id
- case_id
- user_id
- provider
- provider_invoice_id
- invoice_number
- amount
- tax_amount
- status
- invoice_url
- issued_at

### case_events
- id
- case_id
- actor_type
- actor_id
- event_type
- payload
- created_at

## Lifecycle

NEW -> ANALYSIS -> OPPORTUNITY -> PAYMENT_REQUIRED -> PAID -> CLAIM_PREPARED -> SENT -> FOLLOW_UP -> RECOVERED -> CLOSED

États alternatifs : NO_OPPORTUNITY, INCOMPLETE, REFUNDED, CANCELLED

## Sécurité actuelle

- la clé admin n'est jamais stockée dans le dépôt
- les clés Stripe et le secret de webhook ne sont jamais stockés dans le dépôt
- la clé admin est lue côté fonction via variable d'environnement
- le code privé de suivi n'est pas renvoyé par l'API publique après consultation
- aucune donnée bancaire ou mot de passe n'est demandé
- les justificatifs restent gérés par Netlify Forms
- les données sensibles doivent être traitées avec une politique de conservation adaptée

## Variable Netlify nécessaire

RECUPERE_ADMIN_KEY

Cette variable doit être définie côté Netlify avec une valeur secrète et disponible pour les Functions. Elle ne doit jamais être écrite dans GitHub.

## Paiement Stripe désormais codé

- produit Stripe réel : `prod_VOfS3m2r3SXNyr`
- prix réel : `price_1UNs7PRS9BxXjI4TydRc7JIX`
- montant : 9,90 € TTC
- Checkout hébergé Stripe
- métadonnées liées au numéro/code du dossier
- confirmation uniquement via webhook serveur
- passage automatique à `PAID` après confirmation Stripe
- événements d'échec/expiration enregistrés
- création de facture activée dans Checkout

## Prochaine étape produit

1. notifications email client/admin
2. authentification client
3. analyse métier vérifiable par catégorie
4. préparation des réclamations
5. relances automatiques
6. portail client complet
7. pilote de 10 utilisateurs réels