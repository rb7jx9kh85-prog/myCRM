import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { createProspect, updateProspect, deleteProspect } from "../lib/prospects";
import { computeScore } from "../lib/scoring";
import { recommend } from "../config/recommendationEngine";
import { SCORING_CRITERIA, RED_FLAGS, EXTRA_RED_FLAG_FIELDS } from "../config/icpScoring";
import { PIPELINE_STATUSES, ESTABLISHMENT_TYPE_OPTIONS, CANTONS } from "../config/pipeline";
import ScoreBadge from "../components/ScoreBadge";

const EMPTY = {
  name: "",
  type: "restaurant",
  canton: "Valais",
  city: "",
  address: "",
  contactName: "",
  phone: "",
  email: "",
  website: "",
  pipelineStatus: "a_contacter",
  notes: "",
  needsReservation: false,
  strongVisualIdentity: false,
  multiLocation: false,
  criteria: {},
};

// Champs red flag qui ne font pas déjà partie de la grille de score
// (ex: "franchise" est un red flag mais pas un critère à points séparé).
const extraFlagLabels = Object.fromEntries(RED_FLAGS.map((f) => [f.id, f.label]));

export default function ProspectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    getDoc(doc(db, "prospects", id)).then((snap) => {
      if (snap.exists()) setForm({ ...EMPTY, ...snap.data() });
      setLoading(false);
    });
  }, [id, isNew]);

  const { total, redFlags, autoExcluded } = computeScore(form.criteria);
  const { offer, reason } = recommend(form, total, autoExcluded);

  function setCriterion(criterionId, value) {
    setForm((f) => ({ ...f, criteria: { ...f.criteria, [criterionId]: value } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (isNew) {
      const ref = await createProspect(form);
      navigate(`/prospects/${ref.id}`);
    } else {
      await updateProspect(id, form);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce prospect ?")) return;
    await deleteProspect(id);
    navigate("/prospects");
  }

  if (loading) return null;

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{isNew ? "Nouveau prospect" : form.name}</h1>
        {!isNew && <button type="button" className="danger" onClick={handleDelete}>Supprimer</button>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <ScoreBadge score={total} redFlags={redFlags} autoExcluded={autoExcluded} />
        <p style={{ marginBottom: 0 }}>
          <strong>Prestation recommandée :</strong> {offer ? `${offer.label} (${offer.price})` : "Skip"} — {reason}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Informations</h3>
        <label>Nom de l'établissement</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label>Type</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {ESTABLISHMENT_TYPE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        <label>Canton</label>
        <select value={form.canton} onChange={(e) => setForm({ ...form, canton: e.target.value })}>
          {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label>Ville</label>
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />

        <label>Adresse</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

        <label>Site web</label>
        <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />

        <label>Contact (nom du décideur)</label>
        <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />

        <label>Téléphone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

        <label>Email</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Statut pipeline</label>
        <select value={form.pipelineStatus} onChange={(e) => setForm({ ...form, pipelineStatus: e.target.value })}>
          {PIPELINE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Détection besoins (pour la recommandation)</h3>
        <CheckboxRow label="Besoin réservation / prise de rdv" checked={form.needsReservation} onChange={(v) => setForm({ ...form, needsReservation: v })} />
        <CheckboxRow label="Forte identité visuelle / marque" checked={form.strongVisualIdentity} onChange={(v) => setForm({ ...form, strongVisualIdentity: v })} />
        <CheckboxRow label="Plusieurs succursales" checked={form.multiLocation} onChange={(v) => setForm({ ...form, multiLocation: v })} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Grille de scoring ICP</h3>
        {SCORING_CRITERIA.map((c) => (
          <CheckboxRow
            key={c.id}
            label={`${c.label} (${c.points > 0 ? "+" : ""}${c.points})`}
            checked={!!form.criteria[c.id]}
            onChange={(v) => setCriterion(c.id, v)}
          />
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Red flags additionnels</h3>
        {EXTRA_RED_FLAG_FIELDS.map((id) => (
          <CheckboxRow
            key={id}
            label={extraFlagLabels[id]}
            checked={!!form.criteria[id]}
            onChange={(v) => setCriterion(id, v)}
          />
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label>Notes</label>
        <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <button className="primary" type="submit" style={{ marginTop: 16 }}>
        {isNew ? "Créer le prospect" : "Enregistrer"}
      </button>
    </form>
  );
}

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="checkbox" style={{ width: "auto" }} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
