# RÉCUPÈRE — checklist de mise en production

**Règle :** ne pas activer la production commerciale tant que tous les contrôles bloquants ci-dessous ne sont pas validés. Les contrôles GitHub ne remplacent pas les tests dans le navigateur ni les vérifications des comptes fournisseurs.

## 1. Code et déploiement
- [ ] Les PR de fiabilisation du formulaire et du registre cashback ont été relues et fusionnées explicitement.
- [ ] Les contrôles GitHub Actions sont verts sur les commits exacts destinés à la production.
- [ ] Un `package-lock.json` est commité et l'installation reproductible avec `npm ci` est validée.
- [ ] Le déploiement Netlify de production correspond au commit attendu.
- [ ] Les pages publiques et les fonctions API sont accessibles en HTTPS.
- [ ] Aucun dossier de test ni secret n'est inclus dans le dépôt ou affiché publiquement.
- [ ] Une procédure de retour à la version précédente est connue et testée.

## 2. Configuration Netlify — ne jamais partager les valeurs secrètes
Vérifier dans les paramètres Netlify que les variables suivantes existent dans le contexte de production, sans copier leurs valeurs dans GitHub ni dans un chat :
- [ ] `RECUPERE_ADMIN_KEY` — clé forte et unique.
- [ ] `RECUPERE_PAYMENTS_ENABLED` — absent ou `false` par défaut ; ne mettre `true` que pour un test approuvé.
- [ ] `STRIPE_SECRET_KEY` — en sandbox uniquement une clé `sk_test_`; la garde actuelle refuse les clés live.
- [ ] `STRIPE_WEBHOOK_SECRET` — secret correspondant exactement au webhook configuré.
- [ ] `RECUPERE_STRIPE_PRICE_ID` — produit et prix corrects, en EUR, à 9,90 € TTC ou avec la fiscalité explicitement définie.
- [ ] `RECUPERE_BASE_URL` — URL canonique réelle du site de production.
- [ ] `RESEND_API_KEY` et `RESEND_FROM` — domaine expéditeur vérifié.
- [ ] Variables de stockage Netlify Blobs et région compatibles avec l'environnement de production.
- [ ] Les variables de test ne sont pas mélangées avec celles de production.

## 3. Tests manuels obligatoires — sans paiement réel
- [ ] Vérifier que l'API refuse la création d'un dossier si le consentement explicite n'est pas fourni.
- [ ] Vérifier que tout nouveau dossier reste en analyse jusqu'à validation humaine et qu'aucune heuristique ne déclenche seule le paiement.
- [ ] Créer un dossier sans justificatif : un seul dossier est créé et le numéro affiché correspond à celui de l'administration.
- [ ] Les justificatifs sont désactivés dans la branche de travail : avant de les réactiver, implémenter un stockage privé avec contrôle d’accès par dossier, puis tester PDF/image, association au bon dossier et absence d’accès public. Ne pas utiliser Netlify Forms pour des justificatifs personnels sans protection supplémentaire validée.
- [ ] Vérifier la réception d'e-mail, les liens et le dossier dans le portail client.
- [ ] Demander un lien de connexion : lien à usage unique, expiration respectée, cookie sécurisé et déconnexion fonctionnelle.
- [ ] Vérifier qu'un client ne peut pas lire le dossier d'un autre client.
- [ ] Vérifier l'administration avec clé valide et invalide, ainsi que les limites de tentatives.
- [ ] Vérifier que Checkout reste désactivé tant que `RECUPERE_PAYMENTS_ENABLED` n’est pas explicitement à `true`.
- [ ] Tester Stripe en mode test : création Checkout, annulation, succès et expiration, avec clé `sk_test_` et Price ID de test.
- [ ] Envoyer un événement Stripe test signé : statut mis à jour uniquement après vérification du webhook.
- [ ] Simuler une confirmation Stripe arrivant avant l'enregistrement de la session Checkout : le webhook doit demander une nouvelle tentative, pas ignorer définitivement le paiement.
- [ ] Rejouer le même événement Stripe : aucune double opération ni double notification.
- [ ] Vérifier les erreurs d'e-mail et la reprise sans doublon.
- [ ] Tester sur mobile et sur les navigateurs principaux.

## 4. Sécurité, données et exploitation
- [ ] Les secrets ne sont pas dans le code, les journaux, les URL ni les réponses API.
- [ ] Les données personnelles et justificatifs ont des règles de conservation, d'accès, de suppression et de sauvegarde documentées.
- [ ] Les sauvegardes Netlify Blobs et la procédure de restauration ont été vérifiées.
- [ ] Les erreurs et alertes critiques sont surveillées.
- [ ] Les limites de débit et protections contre les soumissions abusives sont vérifiées.
- [ ] Les dossiers de test sont identifiés et ne sont pas présentés comme des dossiers clients.

## 5. Informations légales et promesse commerciale
- [ ] Mentions légales complètes : responsable, coordonnées, forme juridique/identité pertinente, hébergeur et contact.
- [ ] Politique de confidentialité conforme au traitement réel : finalités, base légale, destinataires, durées, droits et contact.
- [ ] CGV/conditions de service et politique de remboursement adaptées à la prestation réellement fournie.
- [ ] Le prix, la TVA éventuelle, le contenu précis de la prestation et le moment du paiement sont clairs avant Checkout.
- [ ] Les règles d'analyse automatisée, ses limites et l'absence de garantie de récupération sont expliquées.
- [ ] Le dépôt et le traitement de justificatifs sont couverts par les informations de confidentialité.
- [ ] Le parcours de réclamation et le support client ont un responsable et un délai de réponse réalistes.
- [ ] Le texte légal a été vérifié par une personne compétente ; aucun nom, SIRET, adresse ou statut d'entreprise n'a été inventé.

## 6. Cashback — désactivé pour le lancement initial
- [ ] La page publique indique que le cashback est en préparation.
- [ ] Le webhook AWIN reste désactivé tant qu'une authentification compatible n'est pas validée.
- [ ] Capitis est testé avec les vraies variables et son schéma d'API confirmé.
- [ ] Aucun solde « payable » n'est présenté comme un virement effectué.
- [ ] Aucun versement client n'est promis avant implémentation et audit du processus de paiement.
- [ ] Le lancement du service principal ne dépend pas d'une intégration cashback non validée.

## 7. Pilote limité
- [ ] Commencer avec 10 utilisateurs volontaires, avec information transparente sur le caractère pilote.
- [ ] Mesurer : dossiers commencés/terminés, erreurs, délais de traitement, taux d'e-mails reçus, demandes de support et valeur réellement apportée.
- [ ] Examiner manuellement chaque dossier avant toute affirmation d'éligibilité ou envoi de réclamation.
- [ ] Confirmer le support, le remboursement et la gestion des incidents avant d'ouvrir plus largement.

## Critère de feu vert
Le lancement est autorisé uniquement après validation des sections 1 à 5, tests manuels documentés, déploiement vérifié et décision explicite du responsable du service. Le cashback reste hors périmètre tant que sa section 6 n'est pas entièrement validée.
