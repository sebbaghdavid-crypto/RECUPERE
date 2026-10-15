# RÉCUPÈRE — moteur initial de routage des réclamations

Cette branche ajoute un premier moteur **déterministe et testable**, sans service d'IA externe ni coût d'API.

## Ce qui est implémenté
- Classement explicable à partir du nom du marchand et du domaine.
- Le format d'une référence commande/facture est un indice faible et ne peut jamais suffire seul.
- Jusqu'à trois candidats, indices explicites, informations manquantes et niveau qualitatif de confiance.
- Validation des URLs : HTTPS et hôte appartenant à un domaine officiel déclaré.
- Aucune action externe n'est autorisée par le moteur : `external_action_allowed` reste toujours `false`.
- Référentiel exemple utilisant uniquement des domaines fictifs `.test`.

## Lancer les tests
Avec Node.js 22 ou une version compatible :

```sh
node --test test/claim-routing.test.mjs
```

## Ce qui n'est PAS encore fait
- Pas de branchement à l'interface ou à une Netlify Function.
- Pas de recherche Internet automatique ni de vérification périodique des sources.
- Pas de référentiel de fournisseurs réels : chaque fiche doit être constituée et vérifiée manuellement.
- Pas d'OCR ni de téléversement de justificatifs.
- Pas d'envoi de réclamation, de paiement ou de cashback.

Étape suivante : valider les tests, ajouter un petit référentiel réel à partir de pages officielles vérifiées, puis intégrer le moteur à une API protégée avec validation utilisateur. Ne pas fusionner avant revue et tests d'intégration.
