
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createProspect, deleteProspect, subscribeProspects, updateProspect } from "../lib/prospects";
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
  const [showArchived, setShowArchived] = useState(false);
  const [checkingWebsites, setCheckingWebsites] = useState(false);
  const [websiteCheckStatus, setWebsiteCheckStatus] = useState("");
  const [checkingPhones, setCheckingPhones] = useState(false);
  const [phoneCheckStatus, setPhoneCheckStatus] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => subscribeProspects(setProspects), []);

  function parseImportedProspects(raw) {
    const lines = raw.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const split = (line) => line.split(/[,;\t]/).map((value) => value.trim().replace(/^"|"$/g, ""));
    const headers = split(lines[0]).map((header) => header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const knownHeaders = ["nom", "name", "entreprise", "company", "telephone", "phone", "tel", "ville", "city", "type", "site", "website", "email"];
    const hasHeader = headers.some((header) => knownHeaders.includes(header));
    const rows = hasHeader ? lines.slice(1) : lines;
    const index = (...names) => headers.findIndex((header) => names.includes(header));
    return rows.map((line) => {
      const values = split(line);
      if (!hasHeader) return { name: values[0], city: values[1] || "", phone: values[2] || "", website: values[3] || "" };
      const value = (...names) => { const i = index(...names); return i >= 0 ? values[i] || "" : ""; };
      return { name: value("nom", "name", "entreprise", "company") || values[0] || "", city: value("ville", "city"), phone: value("telephone", "phone", "tel"), website: value("site", "website"), email: value("email"), type: value("type") };
    }).filter((prospect) => prospect.name);
  }

  async function handleImport() {
    const rows = parseImportedProspects(importText);
    if (!rows.length) { setImportStatus("Aucun prospect reconnu. Utilise une ligne par prospect ou un CSV avec une colonne Nom."); return; }
    setImporting(true); setImportStatus(`Import de ${rows.length} prospect(s) en cours...`);
    try {
      for (const row of rows) await createProspect({ ...row, criteria: {}, pipelineStatus: "a_contacter", archived: false });
      setImportText(""); setShowImport(false); setImportStatus(`${rows.length} prospect(s) importé(s).`);
    } catch { setImportStatus("L’import a échoué. Vérifie ta connexion puis réessaie."); }
    finally { setImporting(false); }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImportText(String(reader.result || "")); setShowImport(true); };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function handleEnrichPhones(onlySelected = false) {
    const selection = new Set(selectedIds);
    const toCheck = prospects.filter((p) => (!onlySelected || selection.has(p.id)) && !p.phone && p.geoapifyPlaceId);
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

  async function handleCheckWebsites(onlySelected = false) {
    const selection = new Set(selectedIds);
    const toCheck = prospects.filter((p) => (!onlySelected || selection.has(p.id)) && p.website && !p.websiteCheck);
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
      if (!showArchived && p.archived) return false;
      if (statusFilter !== "all" && p.pipelineStatus !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      return true;
    });
  }, [prospects, statusFilter, typeFilter, showExcluded, showArchived]);

  const visibleIds = filtered.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  function toggleProspect(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function handleBulkStatusChange(event) {
    const pipelineStatus = event.target.value;
    if (!pipelineStatus || !selectedIds.length) return;
    setBulkBusy(true);
    try {
      const selected = prospects.filter((p) => selectedIds.includes(p.id));
      await Promise.all(selected.map((p) => updateProspect(p.id, { ...p, pipelineStatus })));
      setBulkStatus(`${selected.length} prospect(s) mis à jour.`);
    } catch { setBulkStatus("La modification groupée a échoué."); }
    finally { setBulkBusy(false); event.target.value = ""; }
  }

  async function handleBulkArchive() {
    if (!selectedIds.length || !window.confirm(`Archiver ${selectedIds.length} prospect(s) sélectionné(s) ?`)) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteProspect(id)));
      setBulkStatus(`${selectedIds.length} prospect(s) archivé(s).`);
      setSelectedIds([]);
    } catch { setBulkStatus("L’archivage groupé a échoué."); }
    finally { setBulkBusy(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Prospects</h1>
        <div className="cluster">
          <button onClick={() => setShowImport((visible) => !visible)}>↥ Importer CSV / texte</button>
          <Link to="/prospects/nouveau"><button className="primary">+ Nouveau prospect</button></Link>
        </div>
      </div>

      {showImport && <div className="card import-card">
        <div className="page-header"><div><h2>Importer des prospects</h2><p className="muted">CSV avec en-têtes (Nom, Téléphone, Ville, Site…) ou une ligne par prospect.</p></div><label className="file-picker"><input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleImportFile} /><span>Choisir un fichier</span></label></div>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'Nom, Téléphone, Ville, Site\nBoulangerie Exemple, 079 000 00 00, Sion,\n\nOu simplement une ligne par nom…'} rows={6} />
        <div className="cluster" style={{ justifyContent: "flex-end", marginTop: 10 }}><button onClick={() => setShowImport(false)}>Annuler</button><button className="primary" onClick={handleImport} disabled={importing}>{importing ? "Import..." : "Importer"}</button></div>
      </div>}
      {importStatus && <p className="import-status">{importStatus}</p>}

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
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les archivés
        </label>
        <button onClick={() => handleEnrichPhones(false)} disabled={checkingPhones} style={{ marginLeft: "auto" }}>
          {checkingPhones ? "Recherche..." : "Enrichir les numéros de téléphone"}
        </button>
        <button onClick={() => handleCheckWebsites(false)} disabled={checkingWebsites}>
          {checkingWebsites ? "Vérification..." : "Vérifier les sites web"}
        </button>
      </div>
      {phoneCheckStatus && <p style={{ fontSize: 13, marginTop: -8 }}>{phoneCheckStatus}</p>}
      {websiteCheckStatus && <p style={{ fontSize: 13, marginTop: -8 }}>{websiteCheckStatus}</p>}

      {selectedIds.length > 0 && <div className="card bulk-actions">
        <strong>{selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}</strong>
        <button onClick={() => handleEnrichPhones(true)} disabled={checkingPhones || bulkBusy}>Enrichir téléphones</button>
        <button onClick={() => handleCheckWebsites(true)} disabled={checkingWebsites || bulkBusy}>Vérifier les sites</button>
        <select defaultValue="" onChange={handleBulkStatusChange} disabled={bulkBusy}>
          <option value="" disabled>Changer le statut…</option>
          {PIPELINE_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
        </select>
        <button className="danger-button" onClick={handleBulkArchive} disabled={bulkBusy}>Archiver</button>
        <button onClick={() => setSelectedIds([])} disabled={bulkBusy}>Désélectionner</button>
      </div>}
      {bulkStatus && <p className="import-status">{bulkStatus}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="selection-cell"><input type="checkbox" aria-label="Sélectionner tous les prospects visibles" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
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
              <tr key={p.id} className={selectedIds.includes(p.id) ? "selected-row" : ""}>
                <td className="selection-cell"><input type="checkbox" aria-label={`Sélectionner ${p.name}`} checked={selectedIds.includes(p.id)} onChange={() => toggleProspect(p.id)} /></td>
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
              <tr><td colSpan={9} style={{ color: "var(--text-muted)" }}>Aucun prospect.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
