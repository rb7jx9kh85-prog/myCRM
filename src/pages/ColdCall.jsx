import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { subscribeProspects, logCallOutcome } from "../lib/prospects";
import { subscribeSessions } from "../lib/sessions";
import { CALL_OUTCOMES } from "../config/pipeline";
import ScoreBadge from "../components/ScoreBadge";

export default function ColdCall() {
  const [prospects, setProspects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [params] = useSearchParams();
  const sessionId = params.get("session");

  useEffect(() => subscribeProspects(setProspects), []);
  useEffect(() => subscribeSessions(setSessions), []);

  const session = sessions.find((s) => s.id === sessionId);

  const list = useMemo(() => {
    let base = prospects.filter((p) => p.pipelineStatus === "a_contacter");
    if (session) {
      const ids = new Set(session.prospectIds || []);
      base = base.filter((p) => ids.has(p.id));
    }
    if (!showExcluded) base = base.filter((p) => !p.autoExcluded);
    return base.sort((a, b) => b.scoreTotal - a.scoreTotal);
  }, [prospects, session, showExcluded]);

  async function handleOutcome(prospectId, outcome) {
    let callbackDate = null;
    if (outcome.id === "a_rappeler") {
      const days = prompt("Rappeler dans combien de jours ?", "2");
      if (days) {
        const d = new Date();
        d.setDate(d.getDate() + Number(days));
        callbackDate = d.toISOString().slice(0, 10);
      }
    }
    await logCallOutcome(prospectId, outcome.nextStatus, callbackDate);
  }

  return (
    <div>
      <h1>Session cold call{session ? ` — ${session.date} ${session.startTime}` : ""}</h1>
      <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 16px" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
        Afficher les prospects à exclure
      </label>

      {list.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong>{p.name}</strong>{" "}
            <ScoreBadge score={p.scoreTotal} redFlags={p.redFlags} autoExcluded={p.autoExcluded} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {p.recommendation?.offerLabel || "Skip"} · {p.contactName || "—"} · {p.phone || "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CALL_OUTCOMES.map((o) => (
              <button key={o.id} onClick={() => handleOutcome(p.id, o)}>{o.label}</button>
            ))}
          </div>
        </div>
      ))}
      {list.length === 0 && <p style={{ color: "var(--text-muted)" }}>Rien à appeler pour l'instant.</p>}
    </div>
  );
}
