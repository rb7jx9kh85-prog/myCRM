// Statuts du pipeline de prospection — colonnes correspondantes dans Google Sheets.
export const PIPELINE_STATUSES = [
  { id: "a_contacter", label: "À contacter" },
  { id: "contacte", label: "Contacté" },
  { id: "rdv_pris", label: "RDV pris" },
  { id: "devis_envoye", label: "Devis envoyé" },
  { id: "close", label: "Closé" },
  { id: "perdu", label: "Perdu" },
];

// Résultat d'un appel loggé depuis la vue "session cold call"
// -> statut pipeline correspondant.
export const CALL_OUTCOMES = [
  { id: "no_answer", label: "Pas de réponse", nextStatus: "a_contacter" },
  { id: "refus", label: "Refus", nextStatus: "perdu" },
  { id: "rdv_pris", label: "RDV pris", nextStatus: "rdv_pris" },
  { id: "a_rappeler", label: "À rappeler", nextStatus: "contacte" },
];

export const CANTONS = ["Valais", "Vaud", "Fribourg", "Genève", "Neuchâtel", "Jura"];

export const ESTABLISHMENT_TYPE_OPTIONS = [
  { id: "restaurant", label: "Restaurant" },
  { id: "coiffeur_barber", label: "Coiffeur / Barber" },
  { id: "bar_cafe", label: "Café / Bar" },
  { id: "cave_pme", label: "Cave / PME" },
  { id: "boutique", label: "Boutique" },
  { id: "autre", label: "Autre" },
];
