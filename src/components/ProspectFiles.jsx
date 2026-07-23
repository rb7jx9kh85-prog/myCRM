import { useRef, useState } from "react";
import { auth } from "../firebase";
import { addProspectAttachment, removeProspectAttachment } from "../lib/prospects";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function fileIcon(file) {
  const type = file.contentType || "";
  const ext = file.name?.split(".").pop()?.toLowerCase();
  if (type.startsWith("image/")) return "▧";
  if (ext === "pdf") return "PDF";
  if (["csv", "xls", "xlsx"].includes(ext)) return "CSV";
  return "DOC";
}

async function authHeaders(extra = {}) {
  const token = await auth.currentUser?.getIdToken();
  return { ...extra, Authorization: `Bearer ${token}` };
}

export default function ProspectFiles({ prospectId, attachments = [], onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setMessage("Le fichier dépasse 2 Mo.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: await authHeaders({
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-Prospect-Id": prospectId,
        }),
        body: file,
      });
      const metadata = await response.json();
      if (!response.ok) throw new Error(metadata.error || "Échec de l’envoi.");
      await addProspectAttachment(prospectId, metadata);
      onChange?.([...attachments, metadata]);
      setMessage("Fichier ajouté.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(file) {
    setMessage("");
    try {
      const response = await fetch(`/api/files/download?pathname=${encodeURIComponent(file.pathname)}`, {
        headers: await authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Téléchargement impossible.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRemove(file) {
    if (!confirm(`Supprimer ${file.name} ?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/files/remove", {
        method: "DELETE",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ pathname: file.pathname }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      await removeProspectAttachment(prospectId, file);
      onChange?.(attachments.filter((item) => item.pathname !== file.pathname));
      setMessage("Fichier supprimé.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card prospect-files">
      <div className="page-header">
        <div>
          <h3>Fichiers et médias</h3>
          <p className="muted">Images, PDF, CSV et fichiers courants · 2 Mo maximum</p>
        </div>
        <button type="button" className="secondary-blue" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Envoi…" : "+ Ajouter"}
        </button>
        <input ref={inputRef} hidden type="file" onChange={handleUpload} />
      </div>
      <div className="file-list">
        {attachments.map((file) => (
          <div className="file-row" key={file.pathname}>
            <span className="file-type">{fileIcon(file)}</span>
            <button type="button" className="file-name" onClick={() => handleDownload(file)}>
              <strong>{file.name}</strong>
              <span>{Math.ceil((file.size || 0) / 1024)} Ko</span>
            </button>
            <button type="button" className="danger file-remove" onClick={() => handleRemove(file)} aria-label={`Supprimer ${file.name}`}>×</button>
          </div>
        ))}
        {!attachments.length && <p className="muted" style={{ margin: 0 }}>Aucun fichier joint.</p>}
      </div>
      {message && <p className="file-message">{message}</p>}
    </div>
  );
}
