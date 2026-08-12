import { useMemo, useState } from "react";
import { createProspect } from "../lib/prospects";
import { CANTONS, ESTABLISHMENT_TYPE_OPTIONS } from "../config/pipeline";

const VERDICT_LABELS = {
  prospect_valide: { label: "Recommandé", cls: "success" },
  a_verifier: { label: "À vérifier", cls: "neutral" },
  exclure: { label: "À exclure", cls: "danger" },
};

const RED_FLAG_LABELS = {
  bigChain: "Grande chaîne",
  franchise: "Franchise",
  hasMarketingTeam: "Équipe marketing",
  isAgency: "Agence",
  greatWebsite: "Déjà un très bon site",
  refusedDirect: "Refus déjà exprimé",
  budgetTooSmall: "Budget trop petit",
  closedPermanently: "Fermé définitivement",
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
  const [importingAll, setImportingAll] = useState(false);
  const [hideExcluded, setHideExcluded] = useState(true);
  const [googleMapsChecked, setGoogleMapsChecked] = useState(null);

  const visibleResults = useMemo(
    () => (hideExcluded ? results.filter((r) => r.ai?.verdict !== "exclure") : results),
    [results, hideExcluded]
  );

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    try {
      const params = new URLSearchParams({ canton, type, radiusKm });
      const res = await fetch(`/api/geoapify/search?${params}`);
      const data = await res.json();
      let found = data.results || [];
      found = await enrichMissingPhones(found);
      setResults(found);
      if (found.length) await runEnrich(found);
    } finally {
      setLoading(false);
    }
  }

  // Complète téléphone/site web manquants via Geoapify Place Details (même
  // clé, pas de coût IA) avant l'analyse IA — uniquement pour les fiches
  // incomplètes, en un seul appel groupé.
  async function enrichMissingPhones(list) {
    const missing = list.filter((r) => !r.phone);
    if (!missing.length) return list;
    try {
      const res = await fetch("/api/geoapify/place-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: missing.map((r) => r.id) }),
      });
      const data = await res.json();
      if (data.error || !data.results) return list;
      const byId = Object.fromEntries(data.results.map((r) => [r.id, r]));
      return list.map((r) => {
        const found = byId[r.id];
        if (!found) return r;
        return { ...r, phone: r.phone || found.phone || "", website: r.website || found.website || "" };
      });
    } catch {
      return list;
    }
  }

  // Ciblage automatique : appelée juste après la recherche (plus besoin de
  // cliquer manuellement) et réutilisable pour ré-analyser après un changement.
  async function runEnrich(list) {
    setEnriching(true);
    setEnrichError("");
    try {
      const candidates = list.map((r) => ({ ...r, type }));
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
      setGoogleMapsChecked(data.googleMapsChecked ?? false);
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
    const suggestedCriteria = ai?.suggestedCriteria
      ? Object.fromEntries(Object.entries(ai.suggestedCriteria).filter(([, v]) => v != null))
      : {};
    await createProspect({
      name: place.name,
      type,
      canton,
      city: place.city || "",
      address: place.address || "",
      phone: place.phone || "",
      website: place.website || "",
      geoapifyPlaceId: place.id || null,
      pipelineStatus: "a_contacter",
      criteria: {
        noWebsite: !place.website,
        ...suggestedCriteria,
        ...(ai?.redFlags ? Object.fromEntries(ai.redFlags.map((f) => [f, true])) : {}),
      },
      needsReservation: ai?.suggestedNeedsReservation ?? false,
      strongVisualIdentity: ai?.suggestedStrongVisualIdentity ?? false,
      multiLocation: false,
      aiSuggestedOfferId: ai?.suggestedOfferId || null,
      notes: ai?.reasoning ? `IA : ${ai.reasoning}` : "",
    });
    setImported((s) => ({ ...s, [place.id]: true }));
  }

  async function handleImportAllRecommended() {
    const toImport = results.filter((r) => r.ai?.verdict === "prospect_valide" && !imported[r.id]);
    if (!toImport.length) return;
    setImportingAll(true);
    try {
      for (const place of toImport) {
        await handleImport(place);
      }
    } finally {
      setImportingAll(false);
    }
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
        <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => runEnrich(results)} disabled={enriching}>
            {enriching ? "Analyse IA en cours..." : "Ré-analyser avec l'IA"}
          </button>
          <button className="primary" onClick={handleImportAllRecommended} disabled={importingAll || enriching}>
            {importingAll ? "Import en cours..." : "Importer tous les recommandés"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={hideExcluded} onChange={(e) => setHideExcluded(e.target.checked)} />
            Masquer les exclus ({results.filter((r) => r.ai?.verdict === "exclure").length})
          </label>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            L'IA visite chaque site (extrait réel du contenu) et juge s'il est vide/cassé/dépassé — filtre
            automatiquement fermetures définitives{googleMapsChecked === false ? " (statut Google Maps non vérifié — GOOGLE_PLACES_API_KEY manquante)" : ""} et sites déjà excellents.
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
              <th>Téléphone</th>
              <th>Site web</th>
              <th>Avis IA</th>
              <th>Offre suggérée</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleResults.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.city}</td>
                <td>{r.phone || <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}</td>
                <td>{r.website ? <a href={r.website} target="_blank" rel="noreferrer">lien</a> : <span className="badge success">Pas de site (+30)</span>}</td>
                <td>
                  {r.ai ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className={`badge ${VERDICT_LABELS[r.ai.verdict]?.cls || "neutral"}`} title={r.ai.reasoning}>
                        {VERDICT_LABELS[r.ai.verdict]?.label || r.ai.verdict}
                      </span>
                      {r.ai.redFlags?.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--danger)" }}>
                          {r.ai.redFlags.map((f) => RED_FLAG_LABELS[f] || f).join(", ")}
                        </span>
                      )}
                    </div>
                  ) : enriching ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Analyse...</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>{r.ai?.suggestedOfferId || "—"}</td>
                <td>
                  <button className="primary" disabled={imported[r.id]} onClick={() => handleImport(r)}>
                    {imported[r.id] ? "Importé" : "Importer"}
                  </button>
                </td>
              </tr>
            ))}
            {visibleResults.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ color: "var(--text-muted)" }}>
                {results.length > 0 ? "Tous les résultats sont exclus (décoche « Masquer les exclus » pour les voir)." : "Lance une recherche pour voir des résultats."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
