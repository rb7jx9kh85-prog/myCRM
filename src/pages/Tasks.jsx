import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeTasks, createTask, toggleTaskDone, deleteTask } from "../lib/tasks";
import { subscribeProspects } from "../lib/prospects";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState({ title: "", dueDate: "", prospectId: "" });

  useEffect(() => subscribeTasks(setTasks), []);
  useEffect(() => subscribeProspects(setProspects), []);

  const today = todayStr();

  const groups = useMemo(() => {
    const visible = tasks.filter((t) => showDone || !t.done);
    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    const noDueDate = [];
    for (const t of visible) {
      if (!t.dueDate) noDueDate.push(t);
      else if (t.dueDate < today) overdue.push(t);
      else if (t.dueDate === today) dueToday.push(t);
      else upcoming.push(t);
    }
    return { overdue, dueToday, upcoming, noDueDate };
  }, [tasks, showDone, today]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const prospect = prospects.find((p) => p.id === form.prospectId);
    await createTask({
      title: form.title.trim(),
      dueDate: form.dueDate || null,
      prospectId: prospect?.id || null,
      prospectName: prospect?.name || null,
    });
    setForm({ title: "", dueDate: "", prospectId: "" });
  }

  function renderGroup(label, items) {
    if (items.length === 0) return null;
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>{label}</h3>
        {items.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={t.done} onChange={(e) => toggleTaskDone(t.id, e.target.checked)} />
            <div style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--text-muted)" : "inherit" }}>
              {t.title}
              {t.prospectId && (
                <>
                  {" "}· <Link to={`/prospects/${t.prospectId}`}>{t.prospectName}</Link>
                </>
              )}
              {t.dueDate && <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — {t.dueDate}</span>}
            </div>
            <button className="danger" onClick={() => deleteTask(t.id)}>Suppr.</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1>Tâches</h1>

      <form onSubmit={handleAdd} className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Tâche</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Envoyer le devis à..." />
        </div>
        <div style={{ minWidth: 160 }}>
          <label>Échéance (optionnel)</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <div style={{ minWidth: 200 }}>
          <label>Lier à un prospect (optionnel)</label>
          <select value={form.prospectId} onChange={(e) => setForm({ ...form, prospectId: e.target.value })}>
            <option value="">—</option>
            {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="primary" type="submit">+ Ajouter</button>
      </form>

      <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 12px" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        Afficher les tâches terminées
      </label>

      {renderGroup("En retard", groups.overdue)}
      {renderGroup("Aujourd'hui", groups.dueToday)}
      {renderGroup("À venir", groups.upcoming)}
      {renderGroup("Sans échéance", groups.noDueDate)}

      {tasks.length === 0 && (
        <div className="card" style={{ color: "var(--text-muted)" }}>Aucune tâche pour l'instant.</div>
      )}
    </div>
  );
}
