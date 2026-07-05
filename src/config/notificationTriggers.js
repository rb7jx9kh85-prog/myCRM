// Catalogue des critères de déclenchement de notifications push.
// Chaque entrée = un critère activable/désactivable indépendamment dans
// l'écran Réglages (src/pages/Settings.jsx). L'état on/off de chaque critère
// est stocké dans Firestore: settings/notifications -> { [id]: boolean, ...params }
//
// -----------------------------------------------------------------------
// COMMENT AJOUTER UN NOUVEAU CRITÈRE :
// 1. Ajoute une entrée ici avec un `id` unique, un `label`, et des `params`
//    par défaut si le critère a un seuil réglable (ex: nombre de jours).
// 2. Implémente la vérification correspondante dans api/cron/daily-digest.js
//    (une fonction qui lit Firestore et retourne les messages à envoyer si
//    le critère est activé).
// 3. Rien d'autre à changer : l'écran Réglages génère le toggle
//    automatiquement à partir de cette liste.
// -----------------------------------------------------------------------
//
// NB (contrainte Vercel Hobby) : ces critères sont vérifiés une fois par
// jour via un seul cron (voir vercel.json) et regroupés dans une notification
// "digest" quotidienne plutôt que des push en temps réel à la minute près.

export const NOTIFICATION_TRIGGERS = [
  {
    id: "sessionReminder",
    label: "Rappel avant le début d'une session planifiée",
    defaultEnabled: true,
    params: { minutesBefore: 15 },
    // Note: avec un cron quotidien, ce rappel est inclus dans le digest du
    // matin pour les sessions du jour (pas un push exact à la minute près
    // sauf passage à Vercel Pro).
  },
  {
    id: "callbackDue",
    label: 'Prospect "À rappeler" dont la date arrive à échéance',
    defaultEnabled: true,
    params: {},
  },
  {
    id: "inactivityReminder",
    label: "Aucune activité de prospection depuis X jours",
    defaultEnabled: true,
    params: { days: 3 },
  },
  {
    id: "highScoreImport",
    label: "Nouveau prospect à score ICP élevé importé",
    defaultEnabled: true,
    params: { threshold: 70 },
  },
  {
    id: "quoteFollowup",
    label: 'Prospect en statut "Devis envoyé" depuis plus de X jours sans relance',
    defaultEnabled: true,
    params: { days: 7 },
  },
];
