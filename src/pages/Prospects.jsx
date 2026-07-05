import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProspects, updateProspect } from "../lib/prospects";
import { PIPELINE_STATUSES, ESTABLISHMENT_TYPE_OPTIONS } from "../config/pipeline";
import ScoreBadge from "../components/ScoreBadge";

const WEBSITE_STATUS_LABELS = {
  ancien: { label: "Site ancien", cls: "success" },
  moderne: { label: "Site moderne", cls: "neutral" },
  injoignable: { label: "Injoignable", cls: "danger" },
};

export default function Prospects() {
  const [prospects, setProspects] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showExcluded, setShowExcluded] = useState(false);
  const [checkingWebsites, setCheckingWebsites] = useState(false);
  const [websiteCheckStatus, setWebsiteCheckStatus] = useState("");
  const [checkingPhones, setCheckingPhones] = useState(false);
  const [phoneCheckStatus, setPhoneCheckStatus] = useState("");

  useEffect(() => subscribeProspects(setProspects), []);

  async function handleEnrichPhones() {
    const toCheck = prospects.filter((p) => !p.phone && p.geoapifyPlaceId);
    if (toCheck.length === 0) {
      setPhoneCheckStatus("Aucun numéro manquant à compléter (ou prospect importé avant cette fonctionnalité).");
      return;
    }
    setCheckingPhones(true);
    setPhoneCheckStatus(`Recherche de ${toCheck.length} numéro(s) en cours...`);
    try {
      const res = await fetch("/api/geoapify/place-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: toCheck.map((p) => p.geoapifyPlaceId) }),
      });
      const data = await res.json();
      if (data.error) {
        setPhoneCheckStatus(data.error);
        return;
      }
      let found = 0;
      for (const result of data.results) {
        if (!result.phone) continue;
        const prospect = toCheck.find((p) => p.geoapifyPlaceId === result.id);
        if (!prospect) continue;
        await updateProspect(prospect.id, { ...prospect, phone: result.phone, website: prospect.website || result.website || "" });
        found++;
      }
      setPhoneCheckStatus(`${found} numéro(s) trouvé(s) sur ${toCheck.length} recherché(s).`);
    } catch {
      setPhoneCheckStatus("Échec de la recherche des numéros.");
    } finally {
      setCheckingPhones(false);
    }
  }

  async function handleCheckWebsites() {
    const toCheck = prospects.filter((p) => p.website && !p.websiteCheck);
    if (toCheck.length === 0) {
      setWebsiteCheckStatus("Tous les sites web ont déjà été vérifiés.");
      return;
    }
    setCheckingWebsites(true);
    setWebsiteCheckStatus(`Vérification de ${toCheck.length} site(s) en cours...`);
    try {
      const res = await fetch("/api/enrich/check-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toCheck.map((p) => ({ id: p.id, website: p.website })) }),
      });
      const data = await res.json();
      if (data.error) {
        setWebsiteCheckStatus(data.error);
        return;
      }
      for (const result of data.results) {
        const prospect = toCheck.find((p) => p.id === result.id);
        if (!prospect) continue;
        await updateProspect(prospect.id, {
          ...prospect,
          criteria: { ...prospect.criteria, oldWebsite: result.oldWebsite },
          websiteCheck: { status: result.status, reasoning: result.reasoning, checkedAt: new Date().toISOString() },
        });
      }
      setWebsiteCheckStatus(`${data.results.length} site(s) vérifié(s).`);
    } catch {
      setWebsiteCheckStatus("Échec de la vérification des sites web.");
    } finally {
      setCheckingWebsites(false);
    }
  }

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
        <button onClick={handleEnrichPhones} disabled={checkingPhones} style={{ marginLeft: "auto" }}>
          {checkingPhones ? "Recherche..." : "Enrichir les numéros de téléphone"}
        </button>
        <button onClick={handleCheckWebsites} disabled={checkingWebsites}>
          {checkingWebsites ? "Vérification..." : "Vérifier les sites web"}
        </button>
      </div>
      {phoneCheckStatus && <p style={{ fontSize: 13, marginTop: -8 }}>{phoneCheckStatus}</p>}
      {websiteCheckStatus && <p style={{ fontSize: 13, marginTop: -8 }}>{websiteCheckStatus}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Ville</th>
              <th>Téléphone</th>
              <th>Score</th>
              <th>Site web</th>
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
                <td>{p.phone || <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}</td>
                <td><ScoreBadge score={p.scoreTotal} redFlags={p.redFlags} autoExcluded={p.autoExcluded} /></td>
                <td>
                  {!p.website ? (
                    <span className="badge success">Pas de site</span>
                  ) : p.websiteCheck ? (
                    <span className={`badge ${WEBSITE_STATUS_LABELS[p.websiteCheck.status]?.cls || "neutral"}`} title={p.websiteCheck.reasoning}>
                      {WEBSITE_STATUS_LABELS[p.websiteCheck.status]?.label || p.websiteCheck.status}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Non vérifié</span>
                  )}
                </td>
                <td>{p.recommendation?.offerLabel || "—"}</td>
                <td>{PIPELINE_STATUSES.find((s) => s.id === p.pipelineStatus)?.label || p.pipelineStatus}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ color: "var(--text-muted)" }}>Aucun prospect.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
