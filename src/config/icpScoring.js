// Grille de scoring ICP (Ideal Customer Profile) — AWC
// Fichier volontairement séparé de la logique : modifie les points ici,
// aucune valeur n'est codée en dur ailleurs dans l'app.
//
// Chaque critère est { id, label, points, manual } :
//   - manual: true  -> saisi à la main sur la fiche prospect
//   - manual: false -> déduit automatiquement (ex: depuis Geoapify)

export const SCORING_CRITERIA = [
  { id: "noWebsite", label: "Pas de site web", points: 30, manual: false },
  { id: "oldWebsite", label: "Site très ancien (2015-2020)", points: 20, manual: true },
  { id: "googleReviews", label: "Beaucoup d'avis Google", points: 15, manual: true },
  { id: "qualityPhotos", label: "Belle entreprise (photos de qualité)", points: 10, manual: true },
  { id: "reachableOwner", label: "Patron facilement joignable / contact décideur direct", points: 10, manual: true },
  { id: "activeInstagram", label: "Instagram actif et publications régulières", points: 10, manual: true },
  { id: "localPme", label: "PME locale (1-10 employés, pas de département marketing)", points: 5, manual: true },
  { id: "bigChain", label: "Grande chaîne / franchise", points: -40, manual: true },
  { id: "greatWebsite", label: "Très bon site déjà existant", points: -50, manual: true },
  { id: "refusedDirect", label: 'A déjà refusé clairement ("non" direct)', points: -100, manual: true },
];

// Red flags : affichés en badge rouge "À exclure" dans l'UI.
// Ne masquent PAS le prospect de la liste, sauf si `autoExcludeIfNoPositive`
// est vrai ET qu'aucun critère positif (score > 0) n'est coché -> exclusion
// automatique de la liste active (voir computeScore dans src/lib/scoring.js).
export const RED_FLAGS = [
  { id: "bigChain", label: "Grande chaîne" },
  { id: "franchise", label: "Franchise" },
  { id: "hasMarketingTeam", label: "Équipe marketing interne" },
  { id: "isAgency", label: "Agence (concurrent)" },
  { id: "greatWebsite", label: "Très bon site déjà existant" },
  { id: "refusedDirect", label: "Refus direct déjà exprimé" },
  { id: "budgetTooSmall", label: "Trop petit pour dépasser 450 CHF/an" },
];

// Champs booléens additionnels utilisés uniquement pour détecter les red
// flags qui ne correspondent pas déjà à un critère de score ci-dessus.
export const EXTRA_RED_FLAG_FIELDS = ["franchise", "hasMarketingTeam", "isAgency", "budgetTooSmall"];
