import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeProspects } from "../lib/prospects";
import { subscribeSessions, createSession } from "../lib/sessions";
import { suggestSessions } from "../lib/suggestSessions";

const WEEKDAY_LABELS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}`;
}

export default function Suggestions() {
  const [prospects, setProspects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [angles, setAngles] = useState({}); // { [suggestionKey]: { [prospectId]: { opener, angle } } }
  const [generating, setGenerating] = useState({});
  const [creating, setCreating] = useState({});
  const [created, setCreated] = useState({});
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => subscribeProspects(setProspects), []);
  useEffect(() => subscribeSessions(setSessions), []);

  const suggestions = useMemo(() => suggestSessions(prospects, sessions), [prospects, sessions]);

  async function handleGenerateAngles(suggestion) {
    setGenerating((g) => ({ ...g, [suggestion.key]: true }));
    setError("");
    try {
      const res = await fetch("/api/enrich/call-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospects: suggestion.prospects.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            city: p.city,
            scoreTotal: p.scoreTotal,
            redFlags: p.redFlags,
            offerLabel: p.recommendation?.offerLabel,
            notes: p.notes,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      const byId = {};
      data.results.forEach((r) => {
        const p = suggestion.prospects[r.index];
        if (p) byId[p.id] = { opener: r.opener, angle: r.angle };
      });
      setAngles((a) => ({ ...a, [suggestion.key]: byId }));
    } catch {
      setError("Échec de la génération des angles d'appel.");
    } finally {
      setGenerating((g) => ({ ...g, [suggestion.key]: false }));
    }
  }

  async function handleCreateSession(suggestion) {
    setCreating((c) => ({ ...c, [suggestion.key]: true }));
    try {
      await createSession({
        date: suggestion.date,
        startTime: suggestion.startTime,
        durationMinutes: suggestion.durationMinutes,
        prospectIds: suggestion.prospects.map((p) => p.id),
        callAngles: angles[suggestion.key] || {},
      });
      setCreated((c) => ({ ...c, [suggestion.key]: true }));
    } finally {
      setCreating((c) => ({ ...c, [suggestion.key]: false }));
    }
  }

  return (
    <div>
      <h1>Suggestions</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Créneaux d'appel proposés selon le type d'établissement (voir <code>src/config/callingWindows.js</code>),
        groupés à partir des prospects "à contacter" pas encore planifiés. Génère en option des accroches
        d'appel par IA (un seul appel groupé par session) avant de créer la session dans le planning.
      </p>
      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      {suggestions.length === 0 && (
        <div className="card" style={{ color: "var(--text-muted)" }}>
          Aucune suggestion pour l'instant — tous les prospects "à contacter" sont déjà planifiés, ou aucun
          type d'établissement correspondant n'a de créneau disponible.
        </div>
      )}

      {suggestions.map((s) => (
        <div key={s.key} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong>{s.typeLabel}</strong> — {formatDate(s.date)} à {s.startTime} ({s.durationMinutes} min)
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.reason}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <button onClick={() => handleGenerateAngles(s)} disabled={generating[s.key] || created[s.key]}>
                {generating[s.key] ? "Génération..." : "Accroches IA"}
              </button>
              <button
                className="primary"
                onClick={() => handleCreateSession(s)}
                disabled={creating[s.key] || created[s.key]}
              >
                {created[s.key] ? "Session créée" : creating[s.key] ? "Création..." : "Créer cette session"}
              </button>
              {created[s.key] && <button onClick={() => navigate("/agenda")}>Voir l'agenda</button>}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            {s.prospects.map((p) => (
              <div key={p.id} style={{ borderTop: "1px solid var(--border)", padding: "6px 0", fontSize: 13 }}>
                <strong>{p.name}</strong> ({p.scoreTotal} pts) · {p.city}
                {angles[s.key]?.[p.id] && (
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                    « {angles[s.key][p.id].opener} » — {angles[s.key][p.id].angle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
