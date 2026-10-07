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
  if (mins && !hours) delayMinutes = Number(mins[1]);
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

  if (ecommerce || train || air) {
    result.opportunityLevel = "VERIFY";
    result.confidence = 0.35;
    result.analysisCode = "MANUAL_REVIEW_REQUIRED";
    result.analysisLabel = "Dossier à vérifier manuellement";
    result.analysisSummary = "La catégorie correspond à une famille de situations suivies par RÉCUPÈRE, mais les données fournies sont insuffisantes pour estimer sérieusement une récupération.";
  }
  return result;
}
