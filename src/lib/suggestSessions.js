import { CALLING_WINDOWS } from "../config/callingWindows";

const MAX_PER_SESSION = 6;
const LOOKAHEAD_DAYS = 14;

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function findNextSlot(window, usedSlots) {
  const today = new Date();
  for (let i = 1; i <= LOOKAHEAD_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (!window.bestDays.includes(d.getDay())) continue;
    const dateStr = toDateStr(d);
    for (const slot of window.slots) {
      const key = `${dateStr}_${slot.start}`;
      if (!usedSlots.has(key)) return { date: dateStr, startTime: slot.start };
    }
  }
  return null;
}

// Propose des sessions de cold call groupées par type d'établissement, sur
// les créneaux jugés les plus favorables (src/config/callingWindows.js).
// Ne modifie rien en base — c'est à l'utilisateur de valider chaque
// suggestion pour la transformer en vraie session (voir Planning/Suggestions).
export function suggestSessions(prospects, existingSessions) {
  const alreadyPlanned = new Set(existingSessions.flatMap((s) => s.prospectIds || []));
  const usedSlots = new Set(existingSessions.map((s) => `${s.date}_${s.startTime}`));

  const byType = {};
  for (const p of prospects) {
    if (p.pipelineStatus !== "a_contacter" || p.autoExcluded || alreadyPlanned.has(p.id)) continue;
    (byType[p.type] ||= []).push(p);
  }

  const suggestions = [];

  for (const [type, list] of Object.entries(byType)) {
    const window = CALLING_WINDOWS[type];
    if (!window) continue;
    const sorted = [...list].sort((a, b) => b.scoreTotal - a.scoreTotal);

    for (let i = 0; i < sorted.length; i += MAX_PER_SESSION) {
      const chunk = sorted.slice(i, i + MAX_PER_SESSION);
      const slot = findNextSlot(window, usedSlots);
      if (!slot) break;
      usedSlots.add(`${slot.date}_${slot.startTime}`);
      suggestions.push({
        key: `${type}_${slot.date}_${slot.startTime}`,
        type,
        typeLabel: window.label,
        date: slot.date,
        startTime: slot.startTime,
        durationMinutes: Math.max(30, chunk.length * 10),
        reason: window.reason,
        prospects: chunk,
      });
    }
  }

  return suggestions.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}
