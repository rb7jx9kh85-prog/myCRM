import { SCORING_CRITERIA, RED_FLAGS } from "../config/icpScoring";

// `criteria` = { [criterionId]: boolean } saisi sur la fiche prospect
// (ex: { noWebsite: true, oldWebsite: false, ... })
export function computeScore(criteria = {}) {
  let total = 0;
  let hasPositive = false;

  for (const c of SCORING_CRITERIA) {
    if (criteria[c.id]) {
      total += c.points;
      if (c.points > 0) hasPositive = true;
    }
  }

  const activeRedFlags = RED_FLAGS.filter((f) => criteria[f.id]).map((f) => f.label);

  // Exclusion automatique : au moins un red flag ET aucun point positif.
  const autoExcluded = activeRedFlags.length > 0 && !hasPositive;

  return {
    total,
    hasPositive,
    redFlags: activeRedFlags,
    autoExcluded,
  };
}
