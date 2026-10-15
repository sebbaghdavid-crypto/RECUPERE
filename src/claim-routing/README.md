# RÉCUPÈRE — moteur initial de routage des réclamations

Cette branche ajoute un premier moteur **déterministe et testable**, sans service d'IA externe ni coût d'API.

## Ce qui est implémenté
- Classement explicable à partir du nom du marchand et du domaine.
- Le format d'une référence commande/facture est un indice faible et ne peut jamais suffire seul.
- Jusqu'à trois candidats, indices explicites, informations manquantes et niveau qualitatif de confiance.
- Validation des liens de contact/réclamation : HTTPS et hôte appartenant à un domaine officiel déclaré.
- Les sources publiques d'autorité peuvent être hébergées sur un autre domaine HTTPS (par exemple Service-Public) et sont distinguées des liens du fournisseur.
- Référentiel initial vérifié manuellement : SNCF Connect et Fnac, avec sources officielles datées.
- Endpoint `POST /api/claim-routing` : exige une session utilisateur et le consentement explicite `consent: true`; limite les champs et ne persiste pas les références fournies.
- Aucune action externe n'est autorisée par le moteur : `external_action_allowed` reste toujours `false`.

## Lancer les tests
Avec Node.js 22.12 ou une version compatible :

```sh
node --test test/claim-routing.test.mjs
node --check netlify/functions/claim-routing.mjs
```

La CI vérifie également la syntaxe des fonctions Netlify et lance les tests de routage.

## Limites assumées
- L'endpoint n'est pas encore relié à un écran du portail client.
- Pas de recherche Internet automatique ni de vérification périodique des sources.
- Référentiel volontairement réduit : une référence seule n'identifie jamais un fournisseur.
- Pas d'OCR ni de téléversement de justificatifs.
- Pas d'envoi de réclamation, de paiement ou de cashback.

Étape suivante : valider les tests, puis relier le formulaire au portail connecté avec consentement explicite, affichage des indices et validation humaine. Ajouter les fournisseurs uniquement après vérification de leurs pages officielles. Ne pas fusionner avant revue et tests d'intégration.
