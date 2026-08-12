import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProspects } from "../lib/prospects";
import { subscribeSessions } from "../lib/sessions";
import { subscribeTasks } from "../lib/tasks";
import { PIPELINE_STATUSES } from "../config/pipeline";
import PushNotificationBanner from "../components/PushNotificationBanner";

export default function Dashboard() {
  const [prospects, setProspects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => subscribeProspects(setProspects), []);
  useEffect(() => subscribeSessions(setSessions), []);
  useEffect(() => subscribeTasks(setTasks), []);

  const counts = useMemo(() => {
    const c = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s.id, 0]));
    for (const p of prospects) if (c[p.pipelineStatus] !== undefined) c[p.pipelineStatus]++;
    return c;
  }, [prospects]);

  const topProspects = useMemo(
    () => [...prospects].filter((p) => !p.autoExcluded).sort((a, b) => b.scoreTotal - a.scoreTotal).slice(0, 5),
    [prospects]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingSessions = sessions.filter((s) => s.status === "planned" && s.date >= todayStr).slice(0, 5);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const overdueTasks = pendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr);
  const dueTodayTasks = pendingTasks.filter((t) => t.dueDate === todayStr);

  return (
    <div>
      <h1>Tableau de bord</h1>

      <PushNotificationBanner />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {PIPELINE_STATUSES.map((s) => (
          <div key={s.id} className="card" style={{ minWidth: 130 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{counts[s.id]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Top prospects ICP</h3>
          {topProspects.map((p) => (
            <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <Link to={`/prospects/${p.id}`}>{p.name}</Link> — {p.scoreTotal} pts
            </div>
          ))}
          {topProspects.length === 0 && <p style={{ color: "var(--text-muted)" }}>Aucun prospect pour l'instant.</p>}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Prochaines sessions</h3>
          {upcomingSessions.map((s) => (
            <div key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              {s.date} à {s.startTime} — {s.prospectIds?.length || 0} prospects
            </div>
          ))}
          {upcomingSessions.length === 0 && <p style={{ color: "var(--text-muted)" }}>Aucune session planifiée. <Link to="/agenda">Planifier</Link></p>}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Tâches</h3>
          <p style={{ margin: "0 0 8px" }}>
            <span className="badge danger">{overdueTasks.length} en retard</span>{" "}
            <span className="badge neutral">{dueTodayTasks.length} aujourd'hui</span>{" "}
            <span className="badge neutral">{pendingTasks.length} au total</span>
          </p>
          {[...overdueTasks, ...dueTodayTasks].slice(0, 5).map((t) => (
            <div key={t.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              {t.title}{t.dueDate && ` — ${t.dueDate}`}
            </div>
          ))}
          {pendingTasks.length === 0 && <p style={{ color: "var(--text-muted)" }}>Aucune tâche en attente.</p>}
          <Link to="/taches">Voir toutes les tâches</Link>
        </div>
      </div>
    </div>
  );
}
