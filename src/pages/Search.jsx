import { useState } from "react";
import { createProspect } from "../lib/prospects";
import { CANTONS, ESTABLISHMENT_TYPE_OPTIONS } from "../config/pipeline";

export default function Search() {
  const [canton, setCanton] = useState("Valais");
  const [type, setType] = useState("restaurant");
  const [radiusKm, setRadiusKm] = useState(15);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
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

  async function handleImport(place) {
    await createProspect({
      name: place.name,
      type,
      canton,
      city: place.city || "",
      address: place.address || "",
      phone: place.phone || "",
      website: place.website || "",
      pipelineStatus: "a_contacter",
      criteria: { noWebsite: !place.website },
      needsReservation: false,
      strongVisualIdentity: false,
      multiLocation: false,
      notes: "",
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

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Ville</th>
              <th>Site web</th>
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
                  <button className="primary" disabled={imported[r.id]} onClick={() => handleImport(r)}>
                    {imported[r.id] ? "Importé" : "Importer"}
                  </button>
                </td>
              </tr>
            ))}
            {results.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ color: "var(--text-muted)" }}>Lance une recherche pour voir des résultats.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
