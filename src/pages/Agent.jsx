import { useState } from "react";
import { auth } from "../firebase";

const ACTION_LABELS = {
  "prospect.create": "Créer un prospect",
  "prospect.update": "Modifier un prospect",
  "prospect.add_note": "Ajouter une note",
  "prospect.archive": "Archiver un prospect",
  "prospect.restore": "Restaurer un prospect",
  "task.create": "Ajouter une tâche",
  "task.update": "Modifier une tâche",
  "task.complete": "Terminer une tâche",
  "session.create": "Planifier une session",
  "session.update": "Modifier une session",
  "settings.notifications.update": "Modifier une notification",
};
const SUGGESTIONS = [
  "Quels prospects dois-je appeler en priorité aujourd’hui ?",
  "Crée les tâches de relance utiles pour demain.",
  "Prépare une session de cold call vendredi à 14h avec les meilleurs prospects.",
  "Ajoute une note aux prospects qui ont déjà été contactés.",
];

async function apiRequest(body) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch("/api/crm-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "L’agent CRM a rencontré une erreur.");
  return data;
}

function prepareTextFile(file, text, instruction) {
  if (!file || !text) return "";
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  if (isCsv && instruction.includes("💸")) {
    const lines = text.split(/\r?\n/);
    const header = lines[0] || "";
    return [header, ...lines.slice(1).filter((line) => line.includes("💸"))].join("\n");
  }
  return text.slice(0, 300000);
}

export default function Agent() {
  const [instruction, setInstruction] = useState("");
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState("");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setFileText("");
    setMessage("");
    if (!selected) return;
    if (selected.size > 2 * 1024 * 1024) {
      setMessage("Le fichier dépasse la limite de 2 Mo.");
      setFile(null);
      event.target.value = "";
      return;
    }
    if (/\.(csv|txt|json|md)$/i.test(selected.name) || selected.type.startsWith("text/")) {
      setFileText(await selected.text());
    } else {
      setMessage("Le fichier est joint, mais seuls CSV, TXT, JSON et Markdown peuvent être lus par l’agent.");
    }
  }

  async function handlePlan(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setPlan(null);
    try {
      const preparedFile = prepareTextFile(file, fileText, instruction);
      const data = await apiRequest({
        instruction,
        direct: autoApply,
        ...(preparedFile ? { fileText: preparedFile } : {}),
      });
      if (data.executed) {
        setMessage(`${data.results.length} action(s) appliquée(s) directement dans le CRM.`);
        setInstruction("");
        setFile(null);
        setFileText("");
        setPlan(null);
        return;
      }
      setPlan(data);
      if (!data.actions.length) setMessage(data.summary);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!plan?.actions?.length) return;
    setExecuting(true);
    setMessage("");
    try {
      const data = await apiRequest({ execute: true, actions: plan.actions });
      setMessage(`${data.results.length} action(s) appliquée(s) dans le CRM.`);
      setPlan(null);
      setInstruction("");
      setFile(null);
      setFileText("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="agent-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">GPT-5.6 Terra · niveau normal</div>
          <h1 style={{ marginTop: 8 }}>Agent Alpinia</h1>
          <p className="muted" style={{ margin: 0 }}>Dis-lui ce que tu veux changer. Il prépare le plan, tu confirmes, il exécute.</p>
        </div>
        <span className="agent-spark">✦</span>
      </div>

      <form onSubmit={handlePlan} className="card agent-composer">
        <label htmlFor="agent-instruction">Instruction</label>
        <textarea
          id="agent-instruction"
          rows={6}
          required
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Ex. Ajoute tous les prospects du CSV qui ont 💸, crée une tâche pour les appeler demain et prépare une session de cold call vendredi à 14h."
        />
        <div className="agent-suggestions" aria-label="Suggestions d’instructions">
          {SUGGESTIONS.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => setInstruction(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <div className="agent-controls">
          <label className="file-picker">
            <input type="file" onChange={handleFile} />
            <span>＋ Ajouter un fichier</span>
          </label>
          {file && <span className="file-pill">{file.name} · {(file.size / 1024).toFixed(0)} Ko</span>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Analyse en cours…" : "Préparer les actions"}
          </button>
        </div>
        <label className="agent-direct-toggle">
          <input type="checkbox" style={{ width: "auto" }} checked={autoApply} onChange={(event) => setAutoApply(event.target.checked)} />
          Appliquer directement les changements réversibles après l’analyse
        </label>
        <p className="agent-hint"><strong>Aucun fichier requis.</strong> Si utile, joins un CSV, TXT, JSON ou Markdown jusqu’à 2 Mo.</p>
      </form>

      {message && <div className="card agent-message">{message}</div>}

      {plan?.sources?.length > 0 && (
        <div className="card agent-sources">
          <strong>Sources web consultées</strong>
          <div className="agent-source-list">
            {plan.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.title || source.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {plan?.actions?.length > 0 && (
        <div className="card agent-plan">
          <div className="page-header">
            <div>
              <div className="eyebrow">Validation requise</div>
              <h2>Plan proposé</h2>
              <p className="muted">{plan.summary}</p>
            </div>
            <div className="cluster">
              {plan.agents?.length > 0 && <span className="badge neutral">{plan.agents.length} sous-agent(s)</span>}
              <span className="badge neutral">{plan.actions.length} action(s)</span>
            </div>
          </div>
          <div className="stack">
            {plan.actions.map((action, index) => (
              <div className="agent-action" key={`${action.type}-${index}`}>
                <span className="agent-action-index">{index + 1}</span>
                <div>
                  <strong>{ACTION_LABELS[action.type] || action.type}</strong>
                  <p>{action.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="agent-plan-buttons">
            <button onClick={() => setPlan(null)}>Modifier l’instruction</button>
            <button className="primary" onClick={handleExecute} disabled={executing}>
              {executing ? "Application…" : "Confirmer et appliquer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
