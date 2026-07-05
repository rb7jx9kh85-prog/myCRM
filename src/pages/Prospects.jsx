import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProspects } from "../lib/prospects";
import { PIPELINE_STATUSES, ESTABLISHMENT_TYPE_OPTIONS } from "../config/pipeline";
import ScoreBadge from "../components/ScoreBadge";

export default function Prospects() {
  const [prospects, setProspects] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => subscribeProspects(setProspects), []);

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (!showExcluded && p.autoExcluded) return false;
      if (statusFilter !== "all" && p.pipelineStatus !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      return true;
    });
  }, [prospects, statusFilter, typeFilter, showExcluded]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Prospects</h1>
        <Link to="/prospects/nouveau">
          <button className="primary">+ Nouveau prospect</button>
        </Link>
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">Tous les statuts</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">Tous les types</option>
          {ESTABLISHMENT_TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
          Afficher les exclus
        </label>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Ville</th>
              <th>Score</th>
              <th>Prestation</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/prospects/${p.id}`}>{p.name}</Link></td>
                <td>{ESTABLISHMENT_TYPE_OPTIONS.find((t) => t.id === p.type)?.label || p.type}</td>
                <td>{p.city}</td>
                <td><ScoreBadge score={p.scoreTotal} redFlags={p.redFlags} autoExcluded={p.autoExcluded} /></td>
                <td>{p.recommendation?.offerLabel || "—"}</td>
                <td>{PIPELINE_STATUSES.find((s) => s.id === p.pipelineStatus)?.label || p.pipelineStatus}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--text-muted)" }}>Aucun prospect.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
