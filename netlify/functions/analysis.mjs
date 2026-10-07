const SOURCES = {
  ecommerce: "https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/vente-distance-tout-savoir-sur-votre-droit-de-retractation",
  train: "https://www.economie.gouv.fr/particuliers/voyager-et-se-deplacer/voyage-en-train-quels-sont-vos-droits-en-cas-dannulation-ou-de-retard",
  air: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/voyager-en-avion-quels-droits-pour-les-passagers"
};

const euro = value => {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

const text = value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function analyzeCase(input) {
  const category = text(input.category);
  const description = text(input.description);
  const amount = euro(input.amount);
  const result = {
    opportunityLevel: "NONE",
    estimatedRecovery: null,
    confidence: 0,
    analysisCode: "NO_RULE_MATCH",
    analysisLabel: "Aucune opportunité suffisamment caractérisée",
    analysisSummary: "Les éléments fournis ne permettent pas encore de conclure automatiquement.",
    checks: [],
    sources: []
  };

  const add = (check, source) => { result.checks.push(check); if (source && !result.sources.includes(source)) result.sources.push(source); };

  const ecommerce = /remboursement|retour|retractation|commande|colis|e-commerce|achat en ligne|vente en ligne/.test(category + " " + description);
  const lateRefund = /remboursement.*(tard|jamais|non|attend)|pas.*rembours|rembours.*pas|refund/.test(description);
  if (ecommerce && lateRefund && amount) {
    result.opportunityLevel = "STRONG";
    result.estimatedRecovery = amount;
    result.confidence = 0.82;
    result.analysisCode = "ECO_LATE_REFUND";
    result.analysisLabel = "Remboursement potentiellement réclamable";
    result.analysisSummary = "Le dossier décrit un remboursement qui semble tarder ou ne pas avoir été versé. Le montant indiqué peut servir de base à la réclamation, sous réserve des dates et justificatifs.";
    add("Vérifier la date de la demande de remboursement et la preuve de celle-ci.");
    add("Vérifier les exceptions éventuelles et les conditions de la commande.");
    add("Préparer une demande écrite avec preuve de paiement, retour et demande de remboursement.");
    result.sources.push(SOURCES.ecommerce);
    return result;
  }

  const train = /train|sncf|tgv|intercites|ter/.test(category + " " + description);
  const hours = description.match(/(\d+(?:[.,]\d+)?)\s*(?:h|heure|heures)/);
  const mins = description.match(/(\d+)\s*(?:min|minute|minutes)/);
  let delayMinutes = null;
  if (hours) delayMinutes = Number(hours[1].replace(",", ".")) * 60;
  if (mins) delayMinutes = (delayMinutes ?? 0) + Number(mins[1]);
  if (train && delayMinutes !== null && amount) {
    if (delayMinutes >= 60) {
      const pct = delayMinutes > 120 ? 0.5 : 0.25;
      result.opportunityLevel = "STRONG";
      result.estimatedRecovery = Math.round(amount * pct * 100) / 100;
      result.confidence = 0.78;
      result.analysisCode = delayMinutes > 120 ? "TRAIN_DELAY_50" : "TRAIN_DELAY_25";
      result.analysisLabel = `Indemnisation ferroviaire potentiellement applicable (minimum ${pct * 100} %)`;
      result.analysisSummary = "Le retard indiqué atteint le seuil réglementaire identifié. Le calcul reste conditionné au type de service, au billet et aux éventuelles exceptions.";
      add("Vérifier que le voyage n'a pas déjà été remboursé intégralement.");
      add("Vérifier le type de train, le trajet et les circonstances du retard.");
      add("Conserver billet, preuve du retard et preuve de la demande.");
      result.sources.push(SOURCES.train);
      return result;
    }
  }

  const air = /vol|avion|compagnie aerienne|bagage/.test(category + " " + description);
  const km = description.match(/(\d{3,5})\s*(?:km|kilometres)/);
  if (air && /retard|annul|refus d'embarquement|surbooking/.test(description)) {
    const distance = km ? Number(km[1]) : null;
    if (distance) {
      const fixed = distance <= 1500 ? 250 : distance <= 3500 ? 400 : 600;
      result.opportunityLevel = "VERIFY";
      result.estimatedRecovery = fixed;
      result.confidence = 0.65;
      result.analysisCode = "AIR_EU261_DISTANCE";
      result.analysisLabel = "Indemnisation aérienne potentiellement applicable";
      result.analysisSummary = "La distance fournie permet d'identifier un montant indicatif. La durée réelle du retard, l'itinéraire et les circonstances doivent être vérifiés avant toute conclusion.";
      add("Vérifier le retard à l'arrivée et non seulement au départ.");
      add("Vérifier l'itinéraire, le transporteur et les circonstances exceptionnelles éventuelles.");
      add("Conserver billet, carte d'embarquement, attestation de retard/annulation et justificatifs.");
      result.sources.push(SOURCES.air);
      return result;
    }
  }


  const ruleFamilies = [
    {code:"ECO_UNDELIVERED",keys:/commande|colis|livraison|e-commerce|achat en ligne/,need:/non livre|jamais recu|pas recu|livre.*pas/,label:"Commande non livrée à vérifier",summary:"Une commande semble ne pas avoir été reçue. Il faut vérifier le statut de livraison, la date prévue et le paiement.",checks:["Vérifier la preuve de commande et le paiement.","Vérifier le suivi transporteur et la date de livraison prévue.","Vérifier si un remboursement ou une nouvelle livraison a déjà été obtenu."]},
    {code:"ECO_WITHDRAWAL",keys:/retractation|retour|achat en ligne|vente a distance/,need:/14 jours|delai|annule|annulation|retract/,label:"Droit de rétractation à vérifier",summary:"Le dossier évoque une rétractation ou une annulation d'achat à distance. Les dates et exceptions doivent être contrôlées.",checks:["Vérifier la date de réception ou de conclusion du contrat.","Vérifier la date et la preuve de la demande de rétractation.","Vérifier les exceptions applicables au produit ou service."]},
    {code:"RENT_DEPOSIT",keys:/depot de garantie|caution|location|locataire|bail/,need:/non rendu|pas rendu|retard|restitution/,label:"Dépôt de garantie potentiellement récupérable",summary:"Le dépôt de garantie semble ne pas avoir été restitué. Les dates de remise des clés et les éventuelles retenues sont déterminantes.",checks:["Vérifier la date de remise des clés.","Vérifier l'état des lieux de sortie.","Vérifier les retenues, justificatifs et éventuelles charges."],source:"https://www.service-public.fr/particuliers/vosdroits/F31301"},{code:"PRODUCT_GUARANTEE",keys:/garantie|produit defectueux|panne|conformite|vendeur/,need:/defect|panne|ne marche|non conforme|casse|garantie/,label:"Garantie produit à vérifier",summary:"Un problème de conformité ou de fonctionnement est signalé. Les dates d'achat, de livraison et les justificatifs sont nécessaires.",checks:["Vérifier la date d'achat et la preuve de paiement.","Décrire précisément le défaut et sa date d'apparition.","Vérifier les démarches déjà effectuées auprès du vendeur."]},
    {code:"PRODUCT_RECALL",keys:/rappel produit|rappel|produit dangereux|securite produit/,need:/rappel|dangereux|securite|retour/,label:"Rappel produit à vérifier",summary:"Le produit pourrait faire l'objet d'une mesure de rappel. L'identification exacte du produit est indispensable.",checks:["Vérifier marque, modèle, référence et numéro de lot.","Vérifier l'avis de rappel officiel.","Conserver facture et preuve de possession."]},
    {code:"AIR_BAGGAGE",keys:/bagage|valise|bagage perdu|bagage retarde|bagage endommage/,need:/perdu|retard|retarde|endomm|frais/,label:"Indemnisation bagage à vérifier",summary:"Un problème de bagage est signalé. Le dossier doit être rapproché des justificatifs de déclaration et des frais réellement subis.",checks:["Vérifier le PIR ou justificatif de déclaration.","Conserver les factures des dépenses nécessaires.","Vérifier l'itinéraire, le transporteur et les délais de réclamation."]},
    {code:"TRAIN_OTHER",keys:/train|sncf|tgv|intercites|ter/,need:/annul|supprim|correspondance|retard/,label:"Dossier ferroviaire à vérifier",summary:"Le dossier concerne un incident ferroviaire mais les éléments disponibles ne permettent pas encore de calculer une indemnisation.",checks:["Vérifier le billet et le trajet.","Vérifier le retard ou l'annulation constaté.","Vérifier une éventuelle indemnisation déjà reçue."],source:SOURCES.train},
    {code:"MOBILE_PORTING",keys:/portabilite|numero mobile|changement operateur|operateur mobile/,need:/retard|bloque|numero|portabil/,label:"Incident de portabilité à vérifier",summary:"Un problème de portabilité ou de conservation du numéro est signalé. Les dates et opérateurs doivent être vérifiés.",checks:["Vérifier la date demandée et la date effective de portabilité.","Conserver les confirmations des opérateurs.","Documenter les éventuels frais ou préjudices directement facturés."]},
    {code:"TELECOM_PRICE",keys:/telecom|mobile|internet|box|fibre|operateur/,need:/hausse|augmentation|prix|tarif|facture/,label:"Hausse tarifaire télécom à vérifier",summary:"Une hausse de prix ou de tarif est signalée. Il faut comparer l'ancien et le nouveau tarif ainsi que les notifications reçues.",checks:["Comparer les factures avant et après la hausse.","Vérifier la notification et sa date.","Vérifier les conditions contractuelles et les démarches déjà réalisées."]},
    {code:"ENERGY_OVERPAYMENT",keys:/electricite|gaz|energie|fournisseur energie|facture energie/,need:/trop percu|credit|avoir|surplus|rembourse/,label:"Trop-perçu énergie à vérifier",summary:"Un crédit ou trop-perçu semble exister sur un compte d'énergie. La facture de régularisation et les paiements doivent être rapprochés.",checks:["Comparer consommations, factures et paiements.","Vérifier le solde créditeur indiqué par le fournisseur.","Conserver la facture de régularisation et les relevés utiles."]},
    {code:"ENERGY_BILL",keys:/electricite|gaz|energie|facture energie/,need:/anormale|erreur|surestime|surfactur|compteur/,label:"Facture énergie contestable à vérifier",summary:"La facture paraît anormale. Il faut distinguer erreur de facturation, estimation et consommation réellement constatée.",checks:["Comparer index du compteur et index facturés.","Vérifier la période et les tarifs appliqués.","Conserver les relevés et échanges avec le fournisseur."]},
    
    {code:"RENT_CHARGES",keys:/charges locatives|regularisation charges|location|locataire/,need:/trop|regularisation|rembourse|provision/,label:"Régularisation de charges à vérifier",summary:"Une régularisation ou un trop-perçu de charges est évoqué. Le décompte et les provisions versées sont nécessaires.",checks:["Comparer provisions et dépenses récupérables.","Vérifier le décompte annuel.","Conserver les justificatifs et demandes de régularisation."]},
    {code:"HEALTH_MISSING",keys:/cpam|assurance maladie|mutuelle|remboursement sante|soins|feuille de soins/,need:/non rembourse|oubli|manquant|pas rembourse|rejet/,label:"Remboursement santé à vérifier",summary:"Un remboursement de soins semble manquer. Le décompte, la feuille de soins et la complémentaire doivent être vérifiés.",checks:["Vérifier le décompte de remboursement.","Vérifier l'envoi ou la télétransmission de la feuille de soins.","Vérifier la part mutuelle restante."],source:"https://www.service-public.fr/particuliers/vosdroits/F11616"},
    {code:"TAX_OVERPAYMENT",keys:/impot|fisc|finances publiques|taxe fonciere|impot revenu/,need:/trop paye|trop verse|credit|remboursement|rembourser/,label:"Trop-perçu fiscal à vérifier",summary:"Un crédit ou trop-perçu fiscal est évoqué. Le détail de l'avis et la situation fiscale doivent être vérifiés.",checks:["Vérifier l'avis d'impôt et les paiements effectués.","Vérifier le solde du compte fiscal.","Vérifier si un remboursement est déjà programmé."]},
    {code:"BANK_DEBIT",keys:/banque|prelevement|debit|carte bancaire|virement/,need:/inconnu|contest|fraud|non autorise|erreur/,label:"Opération bancaire contestable à vérifier",summary:"Une opération bancaire est contestée. L'identification de l'opération et les délais de contestation sont indispensables.",checks:["Identifier précisément l'opération et sa date.","Vérifier si elle a été autorisée ou reconnue.","Conserver relevé, preuve de contestation et échanges avec la banque."]},
    {code:"INSURANCE_CLAIM",keys:/assurance|sinistre|indemnisation|assureur/,need:/sinistre|dommage|indemnise|non indemnise|oubli|pas declare/,label:"Sinistre d'assurance à vérifier",summary:"Un sinistre ou une indemnisation manquante est évoqué. Le contrat, la déclaration et les délais doivent être contrôlés.",checks:["Identifier le contrat et les garanties.","Vérifier la date et la preuve de déclaration.","Comparer l'indemnisation reçue avec la décision de l'assureur."]},
    {code:"AIR_UNUSED_TICKET",keys:/billet avion|vol|avion|compagnie aerienne/,need:/non utilise|pas pris|billet inutilise|taxes/,label:"Taxes récupérables sur billet inutilisé à vérifier",summary:"Un billet d'avion non utilisé est signalé. Le billet, son tarif et les taxes effectivement récupérables doivent être vérifiés.",checks:["Vérifier les conditions tarifaires du billet.","Identifier les taxes et redevances concernées.","Vérifier si une demande a déjà été faite."]},
  ];
  const familyText=category+" "+description;
  for(const rule of ruleFamilies){
    if(rule.keys.test(familyText) && rule.need.test(familyText)){
      result.opportunityLevel="VERIFY";
      result.confidence=0.45;
      result.analysisCode=rule.code;
      result.analysisLabel=rule.label;
      result.analysisSummary=rule.summary;
      rule.checks.forEach(x=>add(x,rule.source));
      if(amount) result.estimatedRecovery=amount;
      return result;
    }
  }

  if (ecommerce || train || air) {
    result.opportunityLevel = "VERIFY";
    result.confidence = 0.35;
    result.analysisCode = "MANUAL_REVIEW_REQUIRED";
    result.analysisLabel = "Dossier à vérifier manuellement";
    result.analysisSummary = "La catégorie correspond à une famille de situations suivies par RÉCUPÈRE, mais les données fournies sont insuffisantes pour estimer sérieusement une récupération.";
  }
  return result;
}
