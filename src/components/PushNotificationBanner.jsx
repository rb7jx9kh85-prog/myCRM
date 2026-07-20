import { useEffect, useState } from "react";
import { isStandalone, isIos, enablePushNotifications } from "../lib/pushNotifications";

const DISMISSED_KEY = "awc-push-banner-dismissed";

// Bandeau proactif (Dashboard) qui pousse activement l'utilisateur à finir
// la config des notifications iPhone, plutôt que d'attendre qu'il pense à
// aller dans Réglages : sur iOS, tant que l'app n'est pas ajoutée à l'écran
// d'accueil, les push ne fonctionneront JAMAIS (limite Apple, pas un bug).
export default function PushNotificationBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [status, setStatus] = useState("");
  const [enabling, setEnabling] = useState(false);

  const standalone = isStandalone();
  const ios = isIos();
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";

  useEffect(() => {
    if (permission === "granted") localStorage.setItem(DISMISSED_KEY, "1");
  }, [permission]);

  if (dismissed || permission === "unsupported" || permission === "granted") return null;
  if (ios && !standalone) {
    return (
      <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent, #24463a)" }}>
        <strong>Active les notifications sur iPhone</strong>
        <p style={{ fontSize: 13, margin: "6px 0" }}>
          Sur iPhone, les notifications ne fonctionnent que si l'app est installée : dans Safari, appuie sur
          <strong> Partager</strong> puis <strong>Sur l'écran d'accueil</strong>. Ouvre ensuite l'app depuis
          l'icône ajoutée (pas depuis Safari) pour activer les rappels d'agenda et de prospection.
        </p>
        <button onClick={() => { setDismissed(true); localStorage.setItem(DISMISSED_KEY, "1"); }}>Compris, masquer</button>
      </div>
    );
  }
  if (permission !== "default") return null;

  async function handleEnable() {
    setEnabling(true);
    const res = await enablePushNotifications();
    setStatus(res.ok ? "Notifications activées !" : res.reason);
    setEnabling(false);
    if (res.ok) localStorage.setItem(DISMISSED_KEY, "1");
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent, #24463a)" }}>
      <strong>Active les notifications</strong>
      <p style={{ fontSize: 13, margin: "6px 0" }}>
        Reçois les rappels d'agenda, relances et prospects chauds directement sur cet appareil.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="primary" onClick={handleEnable} disabled={enabling}>
          {enabling ? "Activation..." : "Activer les notifications"}
        </button>
        <button onClick={() => { setDismissed(true); localStorage.setItem(DISMISSED_KEY, "1"); }}>Plus tard</button>
        {status && <span style={{ fontSize: 13 }}>{status}</span>}
      </div>
    </div>
  );
}
