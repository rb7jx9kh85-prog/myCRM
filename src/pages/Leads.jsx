import { useEffect, useMemo, useState } from "react";
import { archiveLead, createLead, restoreLead, subscribeLeads, updateLead } from "../lib/leads";

const LEAD_STATUSES = [
  { id: "nouveau", label: "Nouveau", tone: "blue" },
  { id: "qualifie", label: "Qualifié", tone: "purple" },
  { id: "contacte", label: "Contacté", tone: "orange" },
  { id: "proposition", label: "Proposition", tone: "warning" },
  { id: "negociation", label: "Négociation", tone: "warning" },
  { id: "gagne", label: "Gagné", tone: "success" },
  { id: "perdu", label: "Perdu", tone: "danger" },
];

const EMPTY_FORM = { name: "", company: "", email: "", phone: "", source: "", status: "nouveau", value: "", nextAction: "", notes: "" };
const statusInfo = (status) => LEAD_STATUSES.find((item) => item.id === status) || LEAD_STATUSES[0];
const formatValue = (value) => Number(value || 0)
  ? new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(Number(value))
  : "—";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeLeads(
    (items) => { setLeads(items); setLoading(false); setError(""); },
    () => { setLoading(false); setError("Impossible de charger les leads."); },
  ), []);

  const visibleLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (!showArchived && lead.archived) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      return !needle || [lead.name, lead.company, lead.email, lead.phone, lead.source]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [leads, search, showArchived, statusFilter]);

  const activeLeads = leads.filter((lead) => !lead.archived);
  const pipelineValue = activeLeads.filter((lead) => !["gagne", "perdu"].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.value || 0), 0);
  const wonCount = activeLeads.filter((lead) => lead.status === "gagne").length;
  const followUpCount = activeLeads.filter((lead) => {
    const date = toDate(lead.nextAction);
    return date && date <= new Date() && !["gagne", "perdu"].includes(lead.status);
  }).length;

  function openNewLead() { setEditingId(null); setForm(EMPTY_FORM); setEditorOpen(true); }
  function openLead(lead) {
    setEditingId(lead.id);
    setForm({ name: lead.name || "", company: lead.company || "", email: lead.email || "", phone: lead.phone || "", source: lead.source || "", status: lead.status || "nouveau", value: lead.value || "", nextAction: lead.nextAction || "", notes: lead.notes || "" });
    setEditorOpen(true);
  }
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function saveLead(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true); setError("");
    const payload = { ...form, name: form.name.trim(), value: form.value ? Number(form.value) : 0 };
    try {
      if (editingId) await updateLead(editingId, payload); else await createLead(payload);
      setEditorOpen(false);
    } catch { setError("Le lead n’a pas pu être enregistré."); }
    finally { setSaving(false); }
  }

  async function toggleArchive(lead) {
    if (!lead) return;
    const message = lead.archived ? `Restaurer ${lead.name} dans les leads actifs ?` : `Archiver ${lead.name} ? Le lead sera conservé et pourra être restauré.`;
    if (!window.confirm(message)) return;
    try {
      if (lead.archived) await restoreLead(lead.id); else await archiveLead(lead.id);
      setEditorOpen(false);
    } catch { setError("L’action n’a pas pu être effectuée."); }
  }

  return <div className="leads-page">
    <div className="leads-header">
      <div><span className="eyebrow">ESPACE COMMERCIAL</span><h1>Gestion des leads</h1><p className="page-description">Suivez les opportunités réelles, de la qualification à la signature.</p></div>
      <button className="primary" onClick={openNewLead}>+ Nouveau lead</button>
    </div>

    <section className="lead-stats" aria-label="Aperçu des leads">
      <div className="lead-stat"><span>Leads actifs</span><strong>{activeLeads.length}</strong><small>hors archives</small></div>
      <div className="lead-stat"><span>Valeur du pipeline</span><strong>{formatValue(pipelineValue)}</strong><small>opportunités ouvertes</small></div>
      <div className="lead-stat"><span>À relancer</span><strong>{followUpCount}</strong><small>action arrivée à échéance</small></div>
      <div className="lead-stat"><span>Gagnés</span><strong>{wonCount}</strong><small>depuis le début</small></div>
    </section>

    <div className="card leads-toolbar">
      <div className="lead-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un lead" placeholder="Rechercher un nom, une entreprise, un contact…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous les statuts</option>{LEAD_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select>
      <label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Inclure les archivés</label>
    </div>
    {error && <div className="lead-error" role="alert">{error}</div>}

    <div className="card leads-list-card">
      <div className="leads-list-heading"><strong>{visibleLeads.length} lead{visibleLeads.length === 1 ? "" : "s"}</strong><span>Cliquez sur une ligne pour afficher ou modifier le lead</span></div>
      {loading ? <div className="lead-empty">Chargement des leads…</div> : visibleLeads.length === 0 ? <div className="lead-empty">
        <span className="lead-empty-icon">◎</span><h2>{leads.length ? "Aucun résultat" : "Votre premier lead vous attend"}</h2><p>{leads.length ? "Modifiez les filtres ou la recherche." : "Ajoutez les contacts qui ont montré un intérêt réel pour vos services."}</p>{!leads.length && <button className="primary" onClick={openNewLead}>Créer un lead</button>}
      </div> : <div className="lead-table-wrap"><table className="lead-table">
        <thead><tr><th>Lead</th><th>Coordonnées</th><th>Statut</th><th>Valeur</th><th>Prochaine action</th><th aria-label="Actions" /></tr></thead>
        <tbody>{visibleLeads.map((lead) => {
          const status = statusInfo(lead.status);
          return <tr key={lead.id} className={lead.archived ? "archived" : ""} onClick={() => openLead(lead)}>
            <td><strong>{lead.name}</strong><span>{lead.company || lead.source || "Lead direct"}</span></td>
            <td><span>{lead.email || lead.phone || "—"}</span>{lead.email && lead.phone && <small>{lead.phone}</small>}</td>
            <td><span className={`lead-status ${status.tone}`}><i />{status.label}</span>{lead.archived && <small>Archivé</small>}</td>
            <td><strong>{formatValue(lead.value)}</strong></td>
            <td>{lead.nextAction ? new Intl.DateTimeFormat("fr-CH").format(new Date(`${lead.nextAction}T12:00:00`)) : <span className="muted">Non planifiée</span>}</td>
            <td><button className="icon-button" aria-label={`Modifier ${lead.name}`} onClick={(event) => { event.stopPropagation(); openLead(lead); }}>→</button></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </div>

    {editorOpen && <div className="lead-editor-backdrop" onMouseDown={() => setEditorOpen(false)}><aside className="lead-editor" role="dialog" aria-modal="true" aria-labelledby="lead-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="lead-editor-header"><div><span className="eyebrow">{editingId ? "FICHE LEAD" : "NOUVELLE OPPORTUNITÉ"}</span><h2 id="lead-editor-title">{editingId ? form.name : "Ajouter un lead"}</h2></div><button className="icon-button" aria-label="Fermer" onClick={() => setEditorOpen(false)}>×</button></div>
      <form onSubmit={saveLead}><div className="lead-form-grid">
        <div className="full"><label htmlFor="lead-name">Nom du lead *</label><input id="lead-name" required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Prénom et nom" /></div>
        <div className="full"><label htmlFor="lead-company">Entreprise</label><input id="lead-company" value={form.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Nom de l’entreprise" /></div>
        <div><label htmlFor="lead-email">Email</label><input id="lead-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="nom@entreprise.ch" /></div>
        <div><label htmlFor="lead-phone">Téléphone</label><input id="lead-phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+41…" /></div>
        <div><label htmlFor="lead-status">Statut</label><select id="lead-status" value={form.status} onChange={(event) => updateField("status", event.target.value)}>{LEAD_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></div>
        <div><label htmlFor="lead-value">Valeur estimée (CHF)</label><input id="lead-value" type="number" min="0" step="100" value={form.value} onChange={(event) => updateField("value", event.target.value)} placeholder="0" /></div>
        <div><label htmlFor="lead-source">Source</label><input id="lead-source" value={form.source} onChange={(event) => updateField("source", event.target.value)} placeholder="Recommandation, site web…" /></div>
        <div><label htmlFor="lead-next-action">Prochaine action</label><input id="lead-next-action" type="date" value={form.nextAction} onChange={(event) => updateField("nextAction", event.target.value)} /></div>
        <div className="full"><label htmlFor="lead-notes">Notes</label><textarea id="lead-notes" rows={6} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Contexte, besoin, échanges importants…" /></div>
      </div><div className="lead-editor-actions">
        {editingId && <button type="button" className="danger" onClick={() => toggleArchive(leads.find((lead) => lead.id === editingId))}>{leads.find((lead) => lead.id === editingId)?.archived ? "Restaurer" : "Archiver"}</button>}<span /><button type="button" onClick={() => setEditorOpen(false)}>Annuler</button><button className="primary" type="submit" disabled={saving || !form.name.trim()}>{saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer le lead"}</button>
      </div></form>
    </aside></div>}
  </div>;
}
