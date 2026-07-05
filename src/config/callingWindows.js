// Meilleurs créneaux d'appel à froid par type d'établissement — règles
// métier statiques (aucun coût IA), à ajuster librement selon l'expérience
// terrain. `bestDays` utilise la convention JS Date.getDay() : 0=dimanche,
// 1=lundi, ..., 6=samedi.
export const CALLING_WINDOWS = {
  restaurant: {
    label: "Restaurant",
    bestDays: [2, 3, 4],
    slots: [{ start: "14:30" }],
    reason: "Entre le coup de feu du service de midi et la mise en place du soir.",
  },
  bar_cafe: {
    label: "Café / Bar",
    bestDays: [2, 3, 4],
    slots: [{ start: "10:00" }],
    reason: "Avant l'affluence de midi, salle encore calme.",
  },
  coiffeur_barber: {
    label: "Coiffeur / Barber",
    bestDays: [2, 3, 5],
    slots: [{ start: "13:00" }],
    reason: "Creux entre les rendez-vous du matin et de l'après-midi (lundi souvent fermé).",
  },
  cave_pme: {
    label: "Cave / PME",
    bestDays: [2, 3, 4],
    slots: [{ start: "09:30" }],
    reason: "Début de matinée, avant livraisons et visites.",
  },
  boutique: {
    label: "Boutique",
    bestDays: [2, 3, 4],
    slots: [{ start: "10:30" }],
    reason: "Matinée creuse en semaine, avant l'affluence du week-end.",
  },
};
