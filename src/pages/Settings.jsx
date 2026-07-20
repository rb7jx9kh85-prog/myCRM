import { useEffect, useState } from "react";
import { NOTIFICATION_TRIGGERS } from "../config/notificationTriggers";
import { getNotificationSettings, saveNotificationSettings, defaultNotificationSettings } from "../lib/settings";
import { enablePushNotifications } from "../lib/pushNotifications";

export default function Settings() {
  const [settings, setSettings] = useState(defaultNotificationSettings());
  const [notifStatus, setNotifStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  function updateTrigger(id, patch) {
    setSettings((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  async function handleSave() {
    await saveNotificationSettings(settings);
  }

  async function enablePush() {
    const res = await enablePushNotifications();
    setNotifStatus(res.ok ? "Notifications activées sur cet appareil." : res.reason);
  }

  async function handleSync() {
    setSyncStatus("Synchronisation en cours...");
    setConflicts([]);
    try {
      const res = await fetch("/api/sheets/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncStatus(data.error);
        return;
      }
      if (data.conflicts?.length) {
        setSyncStatus(`${data.conflicts.length} conflit(s) à résoudre ci-dessous.`);
        setConflicts(data.conflicts);
      } else {
        setSyncStatus(`Synchronisation terminée (${data.pushed} envoyé(s), ${data.pulled} reçu(s)).`);
      }
    } catch {
      setSyncStatus("Échec de la synchronisation.");
    }
  }

  async function handleResolve(conflict, keep) {
    await fetch("/api/sheets/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: conflict.id,
        keep,
        sheetRowIndex: conflict.sheetRowIndex,
        crmFields: conflict.crmVersion,
        sheetFields: conflict.sheetVersion,
      }),
    });
    setConflicts((c) => c.filter((x) => x.id !== conflict.id));
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Réglages</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Notifications push</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Sur iPhone : installe l'app via "Ajouter à l'écran d'accueil" (iOS 16.4+ requis) pour recevoir les
          notifications — Safari seul ne suffit pas.
        </p>
        <button className="primary" onClick={enablePush}>Activer les notifications sur cet appareil</button>
        {notifStatus && <p style={{ fontSize: 13 }}>{notifStatus}</p>}

        <h4>Critères de déclenchement</h4>
        {NOTIFICATION_TRIGGERS.map((t) => (
          <div key={t.id} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={settings[t.id]?.enabled ?? t.defaultEnabled}
                onChange={(e) => updateTrigger(t.id, { enabled: e.target.checked })}
              />
              {t.label}
            </label>
            {Object.keys(t.params).map((paramKey) => (
              <div key={paramKey} style={{ marginLeft: 26, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {paramKey} :
                <input
                  type="number"
                  style={{ width: 70 }}
                  value={settings[t.id]?.[paramKey] ?? t.params[paramKey]}
                  onChange={(e) => updateTrigger(t.id, { [paramKey]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
        ))}
        <button className="primary" onClick={handleSave} style={{ marginTop: 12 }}>Enregistrer les réglages</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Google Sheets</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Synchronisation manuelle uniquement (pas de temps réel). En cas de conflit, aucune version n'est
          écrasée automatiquement.
        </p>
        <a href="/api/sheets/auth"><button>Connecter mon compte Google</button></a>{" "}
        <button className="primary" onClick={handleSync}>Synchroniser</button>
        {syncStatus && <p style={{ fontSize: 13 }}>{syncStatus}</p>}

        {conflicts.map((c) => (
          <div key={c.id} className="card" style={{ marginTop: 12, borderColor: "var(--danger)" }}>
            <strong>{c.name}</strong> — modifié des deux côtés depuis la dernière synchro. Quelle version garder ?
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="badge neutral">Version CRM</div>
                <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(c.crmVersion, null, 2)}</pre>
                <button className="primary" onClick={() => handleResolve(c, "crm")}>Garder la version CRM</button>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="badge neutral">Version Sheets</div>
                <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(c.sheetVersion, null, 2)}</pre>
                <button className="primary" onClick={() => handleResolve(c, "sheet")}>Garder la version Sheets</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
