import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeSessions, createSession, deleteSession } from "../lib/sessions";
import { subscribeProspects } from "../lib/prospects";

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export default function Planning() {
  const [sessions, setSessions] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => subscribeSessions(setSessions), []);
  useEffect(() => subscribeProspects(setProspects), []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const [form, setForm] = useState({ date: fmt(new Date()), startTime: "09:00", durationMinutes: 60, prospectIds: [] });

  async function handleCreate(e) {
    e.preventDefault();
    await createSession(form);
    setForm({ date: fmt(new Date()), startTime: "09:00", durationMinutes: 60, prospectIds: [] });
    setShowForm(false);
  }

  function toggleProspect(id) {
    setForm((f) => ({
      ...f,
      prospectIds: f.prospectIds.includes(id) ? f.prospectIds.filter((x) => x !== id) : [...f.prospectIds, id],
    }));
  }

  const candidateProspects = prospects.filter((p) => p.pipelineStatus === "a_contacter" && !p.autoExcluded);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Planning</h1>
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Nouvelle session"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16 }}>
          <label>Date</label>
          <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <label>Heure</label>
          <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <label>Durée (minutes)</label>
          <input type="number" required value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
          <label>Prospects ({form.prospectIds.length} sélectionnés)</label>
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            {candidateProspects.map((p) => (
              <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={form.prospectIds.includes(p.id)} onChange={() => toggleProspect(p.id)} />
                {p.name} ({p.scoreTotal} pts)
              </label>
            ))}
          </div>
          <button className="primary" type="submit" style={{ marginTop: 12 }}>Créer la session</button>
        </form>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}>← Semaine préc.</button>
        <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}>Semaine suiv. →</button>
      </div>

      <div className="planning-grid">
        {days.map((d) => {
          const dayStr = fmt(d);
          const daySessions = sessions.filter((s) => s.date === dayStr);
          return (
            <div key={dayStr} className="card">
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                {d.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              {daySessions.map((s) => (
                <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 6, marginBottom: 6, fontSize: 13 }}>
                  <div>{s.startTime} · {s.durationMinutes}min</div>
                  <div>{s.prospectIds?.length || 0} prospects</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button onClick={() => navigate(`/cold-call?session=${s.id}`)}>Démarrer</button>
                    <button className="danger" onClick={() => deleteSession(s.id)}>Suppr.</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
