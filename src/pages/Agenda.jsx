import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeSessions, createSession, deleteSession } from "../lib/sessions";
import { subscribeTasks, createTask, toggleTaskDone, deleteTask } from "../lib/tasks";
import { subscribeProspects } from "../lib/prospects";
import { taskOccursOn } from "../lib/taskRecurrence";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const RECURRENCE_LABELS = { none: "Ne se répète pas", daily: "Tous les jours", weekly: "Toutes les semaines", monthly: "Tous les mois" };
const REMINDER_OPTIONS = [
  { value: "", label: "Pas de rappel" },
  { value: "15", label: "15 min avant" },
  { value: "60", label: "1h avant" },
  { value: "1440", label: "La veille" },
];

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfGrid(monthStart) {
  const d = new Date(monthStart);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d;
}

export default function Agenda() {
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(fmt(new Date()));
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => subscribeSessions(setSessions), []);
  useEffect(() => subscribeTasks(setTasks), []);
  useEffect(() => subscribeProspects(setProspects), []);

  const gridDays = useMemo(() => {
    const start = startOfGrid(monthCursor);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monthCursor]);

  const todayStr = fmt(new Date());

  function itemsForDay(dayStr) {
    const daySessions = sessions.filter((s) => s.date === dayStr);
    const dayTasks = tasks.filter((t) => taskOccursOn(t, dayStr));
    return { daySessions, dayTasks };
  }

  const selected = itemsForDay(selectedDate);

  const [taskForm, setTaskForm] = useState({ title: "", time: "", reminderMinutesBefore: "", recurrence: "none", prospectId: "" });
  const [sessionForm, setSessionForm] = useState({ startTime: "09:00", durationMinutes: 60, prospectIds: [] });

  async function handleAddTask(e) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const prospect = prospects.find((p) => p.id === taskForm.prospectId);
    await createTask({
      title: taskForm.title.trim(),
      dueDate: selectedDate,
      time: taskForm.time || null,
      reminderMinutesBefore: taskForm.reminderMinutesBefore ? Number(taskForm.reminderMinutesBefore) : null,
      recurrence: taskForm.recurrence,
      prospectId: prospect?.id || null,
      prospectName: prospect?.name || null,
    });
    setTaskForm({ title: "", time: "", reminderMinutesBefore: "", recurrence: "none", prospectId: "" });
    setShowTaskForm(false);
  }

  async function handleAddSession(e) {
    e.preventDefault();
    await createSession({ date: selectedDate, ...sessionForm });
    setSessionForm({ startTime: "09:00", durationMinutes: 60, prospectIds: [] });
    setShowSessionForm(false);
  }

  function toggleSessionProspect(id) {
    setSessionForm((f) => ({
      ...f,
      prospectIds: f.prospectIds.includes(id) ? f.prospectIds.filter((x) => x !== id) : [...f.prospectIds, id],
    }));
  }

  const candidateProspects = prospects.filter((p) => p.pipelineStatus === "a_contacter" && !p.autoExcluded);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1>Agenda</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { const n = new Date(monthCursor); n.setMonth(n.getMonth() - 1); setMonthCursor(n); }}>←</button>
          <button onClick={() => { setMonthCursor(startOfMonth(new Date())); setSelectedDate(todayStr); }}>Aujourd'hui</button>
          <button onClick={() => { const n = new Date(monthCursor); n.setMonth(n.getMonth() + 1); setMonthCursor(n); }}>→</button>
        </div>
      </div>
      <div style={{ margin: "4px 0 12px", fontWeight: 600, textTransform: "capitalize" }}>
        {monthCursor.toLocaleDateString("fr-CH", { month: "long", year: "numeric" })}
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {gridDays.map((d) => {
            const dayStr = fmt(d);
            const inMonth = d.getMonth() === monthCursor.getMonth();
            const { daySessions, dayTasks } = itemsForDay(dayStr);
            const isToday = dayStr === todayStr;
            const isSelected = dayStr === selectedDate;
            return (
              <button
                key={dayStr}
                onClick={() => setSelectedDate(dayStr)}
                style={{
                  minHeight: 52,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  padding: "4px 2px",
                  borderRadius: 8,
                  border: isSelected ? "2px solid var(--accent, #24463a)" : "1px solid var(--border)",
                  background: isToday ? "rgba(36,70,58,0.08)" : "transparent",
                  opacity: inMonth ? 1 : 0.4,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</span>
                <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                  {daySessions.length > 0 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--danger, #b3432b)" }} />}
                  {dayTasks.length > 0 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent, #24463a)" }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })}
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowTaskForm((v) => !v)}>{showTaskForm ? "Annuler" : "+ Tâche"}</button>
            <button onClick={() => setShowSessionForm((v) => !v)}>{showSessionForm ? "Annuler" : "+ Session cold call"}</button>
          </div>
        </div>

        {showTaskForm && (
          <form onSubmit={handleAddTask} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Tâche</label>
              <input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ex: Relancer..." />
            </div>
            <div style={{ minWidth: 110 }}>
              <label>Heure (opt.)</label>
              <input type="time" value={taskForm.time} onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label>Rappel</label>
              <select value={taskForm.reminderMinutesBefore} onChange={(e) => setTaskForm({ ...taskForm, reminderMinutesBefore: e.target.value })}>
                {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 160 }}>
              <label>Répétition</label>
              <select value={taskForm.recurrence} onChange={(e) => setTaskForm({ ...taskForm, recurrence: e.target.value })}>
                {Object.entries(RECURRENCE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label>Lier à un prospect (opt.)</label>
              <select value={taskForm.prospectId} onChange={(e) => setTaskForm({ ...taskForm, prospectId: e.target.value })}>
                <option value="">—</option>
                {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="primary" type="submit">Ajouter</button>
          </form>
        )}

        {showSessionForm && (
          <form onSubmit={handleAddSession} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ minWidth: 110 }}>
                <label>Heure</label>
                <input type="time" required value={sessionForm.startTime} onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })} />
              </div>
              <div style={{ minWidth: 140 }}>
                <label>Durée (min)</label>
                <input type="number" required value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })} />
              </div>
              <button className="primary" type="submit">Créer la session</button>
            </div>
            <label style={{ display: "block", marginTop: 8 }}>Prospects ({sessionForm.prospectIds.length} sélectionnés)</label>
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
              {candidateProspects.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={sessionForm.prospectIds.includes(p.id)} onChange={() => toggleSessionProspect(p.id)} />
                  {p.name} ({p.scoreTotal} pts)
                </label>
              ))}
            </div>
          </form>
        )}

        <div style={{ marginTop: 12 }}>
          {selected.daySessions.length === 0 && selected.dayTasks.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Rien de prévu ce jour-là.</div>
          )}
          {selected.daySessions.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="badge danger">Cold call</span>
              <div style={{ flex: 1 }}>{s.startTime} · {s.durationMinutes}min · {s.prospectIds?.length || 0} prospects</div>
              <button onClick={() => navigate(`/cold-call?session=${s.id}`)}>Démarrer</button>
              <button className="danger" onClick={() => deleteSession(s.id)}>Suppr.</button>
            </div>
          ))}
          {selected.dayTasks.map((t) => {
            const isRealOccurrence = t.dueDate === selectedDate;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                {isRealOccurrence ? (
                  <input type="checkbox" style={{ width: "auto" }} checked={t.done} onChange={(e) => toggleTaskDone(t.id, e.target.checked)} />
                ) : (
                  <span className="badge neutral" title="Occurrence future d'une tâche récurrente">↻</span>
                )}
                <div style={{ flex: 1, textDecoration: isRealOccurrence && t.done ? "line-through" : "none", color: isRealOccurrence && t.done ? "var(--text-muted)" : "inherit" }}>
                  {t.time && <strong>{t.time} · </strong>}
                  {t.title}
                  {t.prospectId && <> · <a href={`/prospects/${t.prospectId}`}>{t.prospectName}</a></>}
                  {t.recurrence !== "none" && <span style={{ fontSize: 11, color: "var(--text-muted)" }}> ({RECURRENCE_LABELS[t.recurrence]})</span>}
                </div>
                {isRealOccurrence && <button className="danger" onClick={() => deleteTask(t.id)}>Suppr.</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
