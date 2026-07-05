import { useState } from "react";
import { createProspect } from "../lib/prospects";
import { CANTONS, ESTABLISHMENT_TYPE_OPTIONS } from "../config/pipeline";

const VERDICT_LABELS = {
  prospect_valide: { label: "Recommandé", cls: "success" },
  a_verifier: { label: "À vérifier", cls: "neutral" },
  exclure: { label: "À exclure", cls: "danger" },
};

export default function Search() {
  const [canton, setCanton] = useState("Valais");
  const [type, setType] = useState("restaurant");
  const [radiusKm, setRadiusKm] = useState(15);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");
  const [imported, setImported] = useState({});

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    try {
      const params = new URLSearchParams({ canton, type, radiusKm });
      const res = await fetch(`/api/geoapify/search?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichError("");
    try {
      const candidates = results.map((r) => ({ ...r, type }));
      const res = await fetch("/api/enrich/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates }),
      });
      const data = await res.json();
      if (data.error) {
        setEnrichError(data.error);
        return;
      }
      setResults((prev) => prev.map((r, i) => {
        const match = data.results.find((x) => x.index === i);
        return match ? { ...r, ai: match } : r;
      }));
    } catch {
      setEnrichError("Échec de l'enrichissement IA.");
    } finally {
      setEnriching(false);
    }
  }

  async function handleImport(place) {
    const ai = place.ai;
    await createProspect({
      name: place.name,
      type,
      canton,
      city: place.city || "",
      address: place.address || "",
      phone: place.phone || "",
      website: place.website || "",
      pipelineStatus: "a_contacter",
      criteria: {
        noWebsite: !place.website,
        ...(ai?.redFlags ? Object.fromEntries(ai.redFlags.map((f) => [f, true])) : {}),
        ...(ai?.suggestedCriteria?.localPme != null ? { localPme: ai.suggestedCriteria.localPme } : {}),
      },
      needsReservation: ai?.suggestedNeedsReservation ?? false,
      strongVisualIdentity: false,
      multiLocation: false,
      notes: ai?.reasoning ? `IA : ${ai.reasoning}` : "",
    });
    setImported((s) => ({ ...s, [place.id]: true }));
  }

  return (
    <div>
      <h1>Recherche de prospects</h1>

      <form onSubmit={handleSearch} className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 160 }}>
          <label>Canton</label>
          <select value={canton} onChange={(e) => setCanton(e.target.value)}>
            {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label>Type d'établissement</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ESTABLISHMENT_TYPE_OPTIONS.filter((t) => t.id !== "autre").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <label>Rayon (km)</label>
          <input type="number" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
        </div>
        <button className="primary" type="submit" disabled={loading}>{loading ? "Recherche..." : "Rechercher"}</button>
      </form>

      {results.length > 0 && (
        <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleEnrich} disabled={enriching}>
            {enriching ? "Analyse IA en cours..." : "Enrichir avec l'IA"}
          </button>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Vérifie l'adéquation avec ton ICP à partir des données disponibles (avis Google, photos, Instagram restent à vérifier manuellement).
          </span>
          {enrichError && <span style={{ fontSize: 13, color: "var(--danger)" }}>{enrichError}</span>}
        </div>
      )}

      <div className="card" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Ville</th>
              <th>Site web</th>
              <th>Avis IA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.city}</td>
                <td>{r.website ? <a href={r.website} target="_blank" rel="noreferrer">lien</a> : <span className="badge success">Pas de site (+30)</span>}</td>
                <td>
                  {r.ai ? (
                    <span className={`badge ${VERDICT_LABELS[r.ai.verdict]?.cls || "neutral"}`} title={r.ai.reasoning}>
                      {VERDICT_LABELS[r.ai.verdict]?.label || r.ai.verdict}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                  )}
                </td>
                <td>
                  <button className="primary" disabled={imported[r.id]} onClick={() => handleImport(r)}>
                    {imported[r.id] ? "Importé" : "Importer"}
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ color: "var(--text-muted)" }}>Lance une recherche pour voir des résultats.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
