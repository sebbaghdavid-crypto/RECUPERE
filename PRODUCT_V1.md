# RÉCUPÈRE — état produit V1

## État vérifié au 13 octobre 2026

Ce document décrit l'état du dépôt, pas une certification de production. Les tests automatisés passent sur les branches de travail, mais l'intégration réelle avec les comptes Netlify, Stripe, Resend et Capitis n'a pas été validée de bout en bout.

**Le lancement public n'est pas autorisé à ce stade.** Le cashback reste désactivé/non ouvert au public. Aucun paiement réel ni versement n'a été déclenché pendant les travaux.

## Parcours de dossier présent dans le code

- Formulaire de création de dossier et stockage côté serveur.
- Vérification du consentement côté serveur.
- Identifiant de dossier et code d'accès privé.
- Pièce jointe via le parcours configuré avec Netlify Forms.
- Statut initial en analyse, sans déclencher automatiquement une demande de paiement sur la seule base d'une heuristique.
- Interface d'administration privée, protégée par une clé d'environnement.
- Journalisation des changements de dossier.
- Page publique indiquant que le cashback n'est pas encore ouvert.
- Checkout Stripe et traitement webhook présents dans le code, mais le paiement est désactivé par défaut. La garde exige un opt-in explicite, une clé `sk_test_` et un Price ID de test explicite ; une clé live est refusée. La configuration de compte, les événements webhook et le parcours sandbox restent à vérifier.

La présence d'une fonctionnalité dans le code ne prouve pas qu'elle fonctionne en production : les comptes tiers, variables d'environnement, domaines, permissions, emails et webhooks doivent être vérifiés séparément.

## Règles de sécurité et de gestion

- Ne jamais ajouter de secrets, clés API ou secrets webhook au dépôt Git.
- Ne jamais demander à l'utilisateur de transmettre ses secrets dans la conversation.
- Ne jamais rendre un montant payable uniquement parce qu'une conversion ou un achat a été détecté.
- Ne pas autoriser un changement manuel d'administration qui contourne la confirmation serveur d'un paiement.
- Les dossiers ambigus, les transactions sans devise explicite et les historiques de paiement incertains doivent rester en revue et exclus des sommes payables.
- Les tests et données fictives ne constituent pas une preuve de récupération d'argent réelle.
- Ne pas activer de cashback, de paiement ou de versement avant les vérifications de bout en bout et les contrôles de conformité.

## Dépendances et contrôles encore nécessaires

1. Le lockfile npm v3 complet est disponible dans la PR #3 ; `npm ci` et les tests ont réussi sur son commit contrôlé. Confirmer sa présence sur le commit candidat final après intégration explicite.
2. Contrôler les variables de production et le contexte d'exécution dans Netlify, sans exposer leurs valeurs.
3. Tester le parcours complet en mode test Stripe : activation contrôlée de `RECUPERE_PAYMENTS_ENABLED`, création du Checkout, succès, échec, expiration, webhook et idempotence.
4. Confirmer dans Stripe le montant, la devise, le mode test/live, les taxes/factures et le secret webhook configuré.
5. Vérifier la configuration Resend, le domaine d'envoi et la réception réelle des emails.
6. Vérifier le contrat/API Capitis avec un environnement autorisé; garder AWIN désactivé tant que l'authentification et le format ne sont pas validés.
7. Compléter et faire vérifier les mentions légales, la politique de confidentialité, les conditions applicables, l'identité de l'exploitant et les coordonnées réelles.
8. Tester le site déployé sur ordinateur et mobile, y compris les erreurs réseau, l'accès aux dossiers et les contrôles d'accès.
9. Réaliser un pilote limité avec des utilisateurs volontaires, mesurer les résultats réels et confirmer la viabilité avant toute dépense.
10. Faire une revue finale de sécurité, de conformité et de sauvegarde/restauration avant le lancement.

## Conditions minimales avant de parler de lancement

- Les tests automatisés sont verts sur le commit candidat.
- Le build et l'installation sont reproductibles.
- Les tests d'intégration tiers sont passés dans des environnements de test.
- Les tests manuels sur le déploiement réel sont documentés.
- Les contrôles légaux et de confidentialité sont terminés.
- Aucun secret ni donnée de test ne fuit dans le parcours public.
- Le cashback et les paiements ne sont activés qu'après une décision explicite et la validation de toutes les étapes ci-dessus.

**Statut actuel : en préparation, non validé pour la production.**
