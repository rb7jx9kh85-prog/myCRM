// Logique de récurrence des tâches d'agenda, partagée entre l'UI (Agenda.jsx)
// et le cron de digest (api/cron/daily-digest.js) — un seul document par
// tâche récurrente, les occurrences sont calculées à la volée, jamais
// stockées à l'avance.
export function taskOccursOn(task, dateStr) {
  if (!task.dueDate || dateStr < task.dueDate) return false;
  if (dateStr === task.dueDate) return true;
  if (!task.recurrence || task.recurrence === "none") return false;
  const due = new Date(task.dueDate + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekly") return due.getDay() === target.getDay();
  if (task.recurrence === "monthly") return due.getDate() === target.getDate();
  return false;
}
