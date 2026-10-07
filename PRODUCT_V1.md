# RÉCUPÈRE — V1

## État réel au 7 octobre 2026

Le dépôt contient maintenant la landing pilot, un formulaire Netlify avec pièce jointe, une API serverless et un stockage persistant Netlify Blobs.

Le produit n'est **pas encore un SaaS complet** : authentification client, paiements, facturation et notifications transactionnelles sont les prochaines briques.

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
- la clé admin est lue côté fonction via variable d'environnement
- le code privé de suivi n'est pas renvoyé par l'API publique après consultation
- aucune donnée bancaire ou mot de passe n'est demandé
- les justificatifs restent gérés par Netlify Forms
- les données sensibles doivent être traitées avec une politique de conservation adaptée

## Variable Netlify nécessaire

RECUPERE_ADMIN_KEY

Cette variable doit être définie côté Netlify avec une valeur secrète et disponible pour les Functions. Elle ne doit jamais être écrite dans GitHub.

## Prochaine étape produit

1. notifications email client/admin
2. authentification client
3. paiement PayPal
4. facturation
5. analyse métier vérifiable par catégorie
6. préparation des réclamations
7. relances automatiques
8. pilote de 10 utilisateurs réels