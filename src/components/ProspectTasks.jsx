import { useEffect, useState } from "react";
import { subscribeTasks, createTask, toggleTaskDone, deleteTask } from "../lib/tasks";

// Tâches liées à un prospect donné, affichées directement sur sa fiche —
// même collection Firestore que l'écran "Tâches" général, filtrée côté client.
export default function ProspectTasks({ prospectId, prospectName }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => subscribeTasks(setTasks), []);

  const linked = tasks.filter((t) => t.prospectId === prospectId);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ title: title.trim(), dueDate: dueDate || null, prospectId, prospectName });
    setTitle("");
    setDueDate("");
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Tâches</h3>
      {linked.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={t.done} onChange={(e) => toggleTaskDone(t.id, e.target.checked)} />
          <div style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--text-muted)" : "inherit" }}>
            {t.title}
            {t.dueDate && <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — {t.dueDate}</span>}
          </div>
          <button className="danger" onClick={() => deleteTask(t.id)}>Suppr.</button>
        </div>
      ))}
      {linked.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune tâche liée à ce prospect.</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input style={{ flex: 1, minWidth: 180 }} placeholder="Nouvelle tâche" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <button type="submit">+ Ajouter</button>
      </form>
    </div>
  );
}
