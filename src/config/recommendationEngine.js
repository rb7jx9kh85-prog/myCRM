// Moteur de recommandation de prestation AWC.
// Modifie les règles ci-dessous pour ajuster la logique métier —
// aucune valeur n'est codée ailleurs dans l'app.
//
// Offres disponibles :
export const OFFERS = {
  STARTER: { id: "starter", label: "Starter", price: "~450 CHF" },
  JUNIOR: { id: "junior", label: "Junior", price: "~600 CHF" },
  ELITE: { id: "elite", label: "PME Élite", price: "~800 CHF" },
  ELITE_PLUS: { id: "elite_plus", label: "Sur devis / PME Élite+", price: "900 CHF+" },
};

// Types d'établissement reconnus (doit correspondre au champ `type` du prospect)
export const ESTABLISHMENT_TYPES = {
  BAR_CAFE: "bar_cafe",
  RESTAURANT: "restaurant",
  COIFFEUR_BARBER: "coiffeur_barber",
  CAVE_PME: "cave_pme",
  BOUTIQUE: "boutique",
  AUTRE: "autre",
};

/**
 * @param {Object} prospect
 * @param {string} prospect.type - un des ESTABLISHMENT_TYPES
 * @param {boolean} prospect.needsReservation - besoin de réservation/rdv détecté
 * @param {boolean} prospect.strongVisualIdentity - forte identité de marque/visuelle
 * @param {boolean} prospect.multiLocation - plusieurs succursales
 * @param {number} scoreTotal - score ICP calculé (computeScore().total)
 * @param {boolean} autoExcluded - vient de computeScore().autoExcluded
 * @returns {{ offer: object|null, reason: string }}
 */
export function recommend(prospect, scoreTotal, autoExcluded) {
  if (autoExcluded || scoreTotal < 0) {
    return { offer: null, reason: "Skip — score négatif ou red flag bloquant" };
  }

  if (prospect.multiLocation) {
    return { offer: OFFERS.ELITE_PLUS, reason: "Multi-succursales détecté" };
  }

  if (
    prospect.type === ESTABLISHMENT_TYPES.BAR_CAFE &&
    !prospect.needsReservation
  ) {
    return { offer: OFFERS.STARTER, reason: "Bar/café sans besoin fonctionnel détecté" };
  }

  if (
    (prospect.type === ESTABLISHMENT_TYPES.RESTAURANT || prospect.type === ESTABLISHMENT_TYPES.COIFFEUR_BARBER) &&
    prospect.needsReservation
  ) {
    return { offer: OFFERS.JUNIOR, reason: "Restaurant/coiffeur avec besoin réservation ou rdv" };
  }

  if (
    (prospect.type === ESTABLISHMENT_TYPES.RESTAURANT || prospect.type === ESTABLISHMENT_TYPES.CAVE_PME) &&
    scoreTotal > 50 &&
    prospect.strongVisualIdentity
  ) {
    return { offer: OFFERS.ELITE, reason: "Établissement établi, score ICP élevé et forte identité visuelle" };
  }

  return { offer: null, reason: "Aucune règle ne correspond — à qualifier manuellement" };
}
