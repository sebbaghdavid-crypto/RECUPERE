# RÉCUPÈRE — spécification du moteur IA d'identification du fournisseur

**Statut :** spécification fonctionnelle, pas encore une fonction déployée. Aucun achat d'API ni activation en production n'est requis pour ce travail.

## Objectif

À partir des informations fournies par l'utilisateur (numéro de commande, numéro de facture, nom du marchand, date, montant, référence de contrat ou extrait de document), proposer automatiquement **le bon fournisseur et la bonne démarche de réclamation/récupération**. Le système doit expliquer ses indices, citer ses sources et demander une confirmation lorsque l'identification n'est pas assez fiable.

Le moteur doit analyser un numéro saisi manuellement et, lorsque le dépôt sécurisé de justificatifs sera implémenté et audité, extraire ces informations d'un document autorisé par l'utilisateur (OCR/lecture de PDF ou d'image). **L'import de justificatifs est actuellement désactivé** : ne pas contourner cette protection.

## Parcours cible

1. **Collecte minimale avec consentement** — l'utilisateur saisit ou autorise l'analyse d'un numéro, du nom du marchand, de la date, du montant et/ou du texte pertinent. Ne demander que les champs utiles. Masquer les données inutiles.
2. **Extraction structurée** — extraire les références et leurs libellés exacts (ex. « commande », « facture », « transaction », « contrat »), le marchand, le domaine de messagerie, le montant, la date, la devise, le produit/service et les indices de remboursement. Conserver la provenance de chaque champ : saisie utilisateur, document ou source externe.
3. **Génération de candidats** — rechercher d'abord dans le référentiel interne versionné des fournisseurs et règles de démarches, puis utiliser des sources publiques pertinentes. Un numéro de commande seul n'est pas un identifiant universel : ne jamais prétendre le résoudre si aucun indice fiable ne le relie à un fournisseur.
4. **Classement explicable** — classer les candidats à partir de plusieurs indices indépendants : nom/raison sociale, domaine officiel, libellé sur le document, format de référence, adresse, contexte de l'achat et concordance date/montant. Le format du numéro est un indice faible, jamais une preuve isolée.
5. **Validation** — afficher le fournisseur proposé, les éléments qui le justifient, le niveau de confiance, les sources, les alternatives plausibles et la donnée manquante. Demander à l'utilisateur de confirmer si la confiance n'est pas élevée.
6. **Résolution de la démarche** — retrouver la page officielle d'aide/réclamation, la politique de remboursement, le formulaire ou le canal de contact officiel, les conditions d'éligibilité et les délais connus. Préférer les domaines officiels et les sources publiques faisant autorité ; conserver l'URL et la date de vérification.
7. **Analyse d'éligibilité** — comparer les faits du dossier aux règles datées de la démarche. Séparer clairement faits établis, déclarations utilisateur, hypothèses et points à vérifier. Afficher une estimation ou une possibilité, jamais une garantie de récupération.
8. **Préparation et validation humaine** — préparer un brouillon adapté avec les références pertinentes. Aucune réclamation, contestation bancaire, annulation, partage de document ou demande juridiquement engageante ne part automatiquement sans validation explicite de l'utilisateur.
9. **Suivi et audit** — enregistrer les versions du référentiel, sources, horodatage, décision de classement, niveau de confiance, corrections de l'utilisateur et statut de la démarche. Prévoir suppression et durée de conservation.

## Modèle de données du référentiel

Chaque entrée fournisseur/démarche doit inclure, lorsque disponible :

- provider_id, display_name, legal_name, country, category
- official_domains[], official_support_urls[], official_claim_urls[]
- identifier_patterns[] (expression régulière facultative, description, pays, exemples synthétiques et niveau de fiabilité)
- required_evidence[], eligibility_rules[], exclusions[], deadlines[]
- refund_or_claim_types[], steps[], contact_channels[]
- source_urls[], source_type, checked_at, valid_from, valid_until
- confidence_policy, human_review_required, notes

Ne jamais enregistrer de secrets, identifiants de connexion ou numéro de carte bancaire dans ce référentiel. Les exemples de numéros doivent être fictifs ou explicitement publics.

## Score de confiance proposé

Le score doit être calibré à partir de cas de test étiquetés ; les poids ci-dessous sont un point de départ, pas une mesure de performance déjà validée.

- Correspondance d'un domaine ou d'une URL officielle : indice fort.
- Nom commercial explicite extrait du document et concordance avec une source officielle : indice fort.
- Correspondance du nom légal via un registre public : indice complémentaire.
- Concordance de date, montant, produit et référence dans le même document : indices complémentaires.
- Format du numéro de commande ou de facture sans autre indice : indice faible.
- Résultats web non officiels, annuaires commerciaux ou forums : indices faibles à vérifier.

Règle d'interface provisoire :
- **Confiance élevée** : afficher une proposition sourcée, mais demander confirmation avant toute action externe.
- **Confiance moyenne** : montrer jusqu'à trois candidats et poser une question ciblée.
- **Confiance faible / candidats contradictoires** : ne pas deviner ; demander le nom du marchand, le domaine ou un extrait non sensible.
- Une source absente, expirée ou contradictoire empêche l'automatisation de la démarche.

Ne pas afficher un pourcentage de confiance tant qu'il n'a pas été calibré et évalué. Au début, utiliser des niveaux qualitatifs et expliquer les indices.

## Référentiels et recherche en ligne

L'IA ne doit pas dépendre d'une unique recherche libre. Utiliser un système en couches :

1. **Référentiel interne vérifié** : fournisseurs et démarches réellement étudiés, avec historique et date de dernière vérification.
2. **Sites officiels des fournisseurs** : centre d'aide, conditions générales, politique de remboursement, réclamations et mentions légales.
3. **Sources publiques officielles françaises** pour valider l'identité légale d'une entreprise : Annuaire des Entreprises / API Recherche d'Entreprises, Sirene/Insee et, lorsque pertinent, annuaire de facturation électronique. Ces sources peuvent confirmer l'identité d'une société, mais **ne relient généralement pas un numéro de commande consommateur à cette société**.
4. **Sources sectorielles ou associatives fiables** : uniquement comme complément, avec source, date et niveau d'autorité visibles.
5. **Recherche web générale** : découverte de pistes seulement ; toute instruction ou règle importante doit être confirmée par une source officielle ou marquée comme non vérifiée.

Sources de référence initiales :
- API Recherche d'Entreprises (documentation officielle) : https://recherche-entreprises.api.gouv.fr/docs/
- Annuaire des Entreprises — informations légales publiques : https://annuaire-entreprises.data.gouv.fr/
- Insee — base Sirene et moyens d'accès : https://www.insee.fr/fr/information/3591226
- Annuaire de la facturation électronique (information officielle) : https://www.economie.gouv.fr/entreprises/quest-ce-que-lannuaire-de-la-facturation-electronique
- Service-Public — achat à distance, réclamations et remboursements : https://www.service-public.gouv.fr/particuliers/vosdroits/F10868

Vérifier les conditions d'utilisation, quotas, licences et règles de réutilisation de chaque source avant intégration. Les sources citées ci-dessus sont des pistes de référence, pas des intégrations déjà réalisées.

## Garde-fous obligatoires

- Consentement explicite avant analyse de documents ou recherche utilisant des données personnelles.
- Minimisation des données, chiffrement en transit et au repos, contrôle d'accès par dossier, journalisation sans secrets et politique de suppression.
- Ne pas demander ni stocker les mots de passe de messagerie, codes bancaires ou numéros complets de carte.
- Défense contre les instructions malveillantes contenues dans les documents et pages web : les traiter comme des données non fiables, jamais comme des instructions au modèle.
- Ne pas inventer un fournisseur, un lien, une condition, une date limite ou un montant récupérable.
- Ne pas soumettre automatiquement une réclamation, ne pas résilier un contrat, ne pas effectuer d'achat ni de paiement.
- Toute règle de droit doit indiquer sa source et sa date de vérification ; les cas ambigus sont transmis à un humain.
- Les paiements et le cashback restent désactivés et hors périmètre de ce moteur.

## Tests d'acceptation avant toute mise en service

- Plusieurs fournisseurs avec des références similaires : aucune identification à partir du seul format du numéro.
- Même numéro avec deux marchands possibles : l'IA demande une précision.
- Nom commercial et raison sociale différents : correspondance expliquée et sourcée.
- Document illisible ou OCR incertain : ne pas fabriquer de champs.
- Source officielle indisponible ou modifiée : signaler l'incertitude et ne pas utiliser une ancienne règle sans avertissement.
- Prompt injection dans une facture ou une page web : contenu ignoré comme instruction.
- Tentative d'accès au dossier d'un autre utilisateur : refus.
- Fournisseur non trouvé : dire qu'il n'a pas été identifié, proposer la saisie du marchand ou une recherche manuelle.
- Toute proposition inclut fournisseur candidat, indices, URL officielle, date de vérification, informations manquantes et prochaine étape.
- Aucun envoi externe sans approbation explicite.
- Mesurer précision top-1/top-3, faux positifs, taux de demandes de clarification et exactitude des sources sur un jeu de test validé manuellement.

## Limite de la version actuelle

Cette spécification n'implique pas que l'OCR, les recherches web automatiques ou le moteur de classement soient déjà codés. La prochaine étape est de construire un premier moteur déterministe et testable sur un référentiel restreint, avant d'ajouter une IA générative en appui. Aucun service payant n'est nécessaire pour écrire et tester la première version locale.
