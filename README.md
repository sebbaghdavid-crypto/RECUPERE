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
- recherche et filtres
- changement de statut
- historique des événements
- stockage persistant via Netlify Blobs

## Déploiement

Le dépôt est connecté à Netlify : les pushes sur `main` déclenchent les déploiements de production.

## Configuration indispensable

Créer dans Netlify une variable d'environnement **RECUPERE_ADMIN_KEY**, disponible pour les Functions.

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
3. PayPal
4. facturation
5. moteur d'analyse par catégorie
6. préparation des réclamations
7. relances automatiques
8. pilote utilisateurs réels
