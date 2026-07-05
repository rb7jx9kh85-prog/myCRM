// Digest quotidien de notifications (contrainte Vercel Hobby : 1 cron/jour max,
// donc pas de push en temps réel à la minute près — voir src/config/notificationTriggers.js).
// Déclenché par vercel.json ("crons"). Vercel ajoute automatiquement l'en-tête
// Authorization: Bearer <CRON_SECRET> si la variable d'env CRON_SECRET est définie.
import { getMessaging } from "firebase-admin/messaging";
import { getAdminDb } from "../_firebaseAdmin.js";
import { NOTIFICATION_TRIGGERS } from "../../src/config/notificationTriggers.js";
import { getApps } from "firebase-admin/app";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).end();
    }
  }

  const db = getAdminDb();
  const settingsSnap = await db.collection("settings").doc("notifications").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};

  function enabled(id) {
    const defaults = NOTIFICATION_TRIGGERS.find((t) => t.id === id);
    return settings[id]?.enabled ?? defaults?.defaultEnabled ?? false;
  }
  function param(id, key) {
    const defaults = NOTIFICATION_TRIGGERS.find((t) => t.id === id)?.params || {};
    return settings[id]?.[key] ?? defaults[key];
  }

  const [prospectsSnap, sessionsSnap] = await Promise.all([
    db.collection("prospects").get(),
    db.collection("sessions").get(),
  ]);
  const prospects = prospectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const today = todayStr();
  const now = Date.now();
  const lines = [];

  if (enabled("sessionReminder")) {
    const todaySessions = sessions.filter((s) => s.date === today && s.status === "planned");
    if (todaySessions.length) {
      lines.push(`${todaySessions.length} session(s) cold call aujourd'hui : ${todaySessions.map((s) => s.startTime).join(", ")}`);
    }
  }

  if (enabled("callbackDue")) {
    const due = prospects.filter((p) => p.nextCallDate && p.nextCallDate <= today && p.pipelineStatus !== "close" && p.pipelineStatus !== "perdu");
    if (due.length) lines.push(`${due.length} prospect(s) "à rappeler" arrivent à échéance : ${due.map((p) => p.name).join(", ")}`);
  }

  if (enabled("inactivityReminder")) {
    const days = param("inactivityReminder", "days") ?? 3;
    const cutoff = now - days * 86400000;
    const lastActivity = Math.max(0, ...prospects.map((p) => p.updatedAt?.toMillis?.() || 0));
    if (lastActivity < cutoff) {
      lines.push(`Aucune activité de prospection depuis ${days}+ jours.`);
    }
  }

  if (enabled("highScoreImport")) {
    const threshold = param("highScoreImport", "threshold") ?? 70;
    const cutoff = now - 86400000;
    const fresh = prospects.filter((p) => (p.createdAt?.toMillis?.() || 0) >= cutoff && p.scoreTotal > threshold);
    if (fresh.length) lines.push(`${fresh.length} nouveau(x) prospect(s) à score élevé (>${threshold}) : ${fresh.map((p) => p.name).join(", ")}`);
  }

  if (enabled("quoteFollowup")) {
    const days = param("quoteFollowup", "days") ?? 7;
    const cutoff = now - days * 86400000;
    const stale = prospects.filter((p) => p.pipelineStatus === "devis_envoye" && (p.lastContactDate?.toMillis?.() || 0) < cutoff);
    if (stale.length) lines.push(`${stale.length} devis envoyé(s) depuis plus de ${days} jours sans relance : ${stale.map((p) => p.name).join(", ")}`);
  }

  if (!lines.length) {
    return res.status(200).json({ sent: false, reason: "Rien à signaler aujourd'hui." });
  }

  const tokensSnap = await db.collection("settings").doc("fcmTokens").get();
  const tokens = tokensSnap.exists ? Object.keys(tokensSnap.data()) : [];

  if (tokens.length && getApps().length) {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "AWC CRM — Digest du jour",
        body: lines.join(" · "),
      },
    });
  }

  res.status(200).json({ sent: tokens.length > 0, lines });
}
