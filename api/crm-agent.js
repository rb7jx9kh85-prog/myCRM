import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./_firebaseAdmin.js";
import { requireUser, sendApiError } from "./_apiAuth.js";

const PROSPECT_FIELDS = new Set([
  "name", "type", "canton", "city", "address", "contactName", "phone", "email",
  "website", "pipelineStatus", "notes", "needsReservation", "strongVisualIdentity",
  "multiLocation", "nextCallDate",
]);
const TASK_FIELDS = new Set(["title", "dueDate", "done", "prospectId", "prospectName"]);
const SESSION_FIELDS = new Set(["date", "startTime", "durationMinutes", "prospectIds", "status"]);
const PIPELINE_STATUSES = new Set(["a_contacter", "contacte", "rdv_pris", "devis_envoye", "close", "perdu"]);
const SESSION_STATUSES = new Set(["planned", "done"]);
const SETTING_RULES = {
  sessionReminder: new Set(["enabled", "minutesBefore"]),
  callbackDue: new Set(["enabled"]),
  inactivityReminder: new Set(["enabled", "days"]),
  highScoreImport: new Set(["enabled", "threshold"]),
  quoteFollowup: new Set(["enabled", "days"]),
};
const ACTION_TYPES = new Set([
  "prospect.create", "prospect.update", "prospect.add_note",
  "task.create", "task.update", "task.complete",
  "session.create", "session.update",
  "settings.notifications.update",
]);

function cleanObject(input, allowed) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([key, value]) => allowed.has(key) && value !== undefined)
  );
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("");
}

function parsePlan(text) {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("L’agent n’a pas renvoyé un plan exploitable.");
  const cleaned = raw.slice(start, end + 1);
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.actions)) throw new Error("Plan IA invalide.");
  return {
    summary: String(parsed.summary || "Plan proposé par l’agent."),
    actions: parsed.actions
      .slice(0, 100)
      .map((action) => ({
        type: String(action.type || ""),
        targetId: action.targetId ? String(action.targetId) : null,
        description: String(action.description || action.type || "Action CRM"),
        payload: action.payload && typeof action.payload === "object" ? action.payload : {},
      }))
      .filter((action) => ACTION_TYPES.has(action.type)),
  };
}

function serializableData(doc) {
  const data = doc.data();
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value?.toDate ? value.toDate().toISOString() : value,
    ])
  );
}

async function buildPlan(instruction, fileText = "") {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY manque dans Vercel.");
    error.statusCode = 503;
    throw error;
  }

  const db = getAdminDb();
  const [prospectsSnap, tasksSnap, sessionsSnap] = await Promise.all([
    db.collection("prospects").limit(300).get(),
    db.collection("tasks").limit(120).get(),
    db.collection("sessions").limit(80).get(),
  ]);

  const state = {
    prospects: prospectsSnap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id, name: p.name || "", city: p.city || "", phone: p.phone || "",
        email: p.email || "", website: p.website || "", pipelineStatus: p.pipelineStatus || "",
        scoreTotal: p.scoreTotal ?? null, notes: String(p.notes || "").slice(0, 240),
      };
    }),
    tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...serializableData(d) })),
    sessions: sessionsSnap.docs.map((d) => ({ id: d.id, ...serializableData(d) })),
  };

  const system = `Tu es l’agent opérationnel du CRM Alpinia Web Craft.
Tu peux analyser l’état du CRM, répondre à une question, puis transformer une instruction en actions précises.
Tu ne modifies jamais le code de l’application. Tu ne réponds qu’en JSON valide, sans markdown.

Format obligatoire :
{"summary":"réponse ou résumé bref et utile en français","actions":[{"type":"type autorisé","targetId":"id ou null","description":"description lisible et précise","payload":{}}]}

Types autorisés :
- prospect.create, prospect.update, prospect.add_note
- task.create, task.update, task.complete
- session.create, session.update
- settings.notifications.update

Règles :
- N’invente jamais un targetId : utilise exactement un id présent dans l’état CRM.
- Pour une simple question ou analyse, retourne une réponse dans summary et zéro action.
- prospect.create payload : name obligatoire, puis type, canton, city, address, contactName, phone, email, website, pipelineStatus, notes si disponibles.
- prospect.update payload : uniquement les champs à changer.
- prospect.add_note payload : note obligatoire. Cette action ajoute la note sans effacer les notes existantes.
- task.create payload : title obligatoire, dueDate au format YYYY-MM-DD ou null, prospectId/prospectName si lié.
- task.update payload : title, dueDate, prospectId ou prospectName. task.complete ne requiert aucun payload.
- session.create payload : date YYYY-MM-DD, startTime HH:mm, durationMinutes, prospectIds.
- session.update utilise les mêmes champs.
- settings.notifications.update payload : ruleId parmi sessionReminder, callbackDue, inactivityReminder, highScoreImport, quoteFollowup ; patch contient enabled et/ou le seuil accepté par la règle.
- Une instruction collective devient plusieurs actions ciblées. Maximum 100 actions.
- Pour “tous les prospects où il y a 💸”, utilise uniquement les lignes du fichier qui contiennent réellement 💸.
- N’efface jamais de données sans demande explicite. Si l’instruction est ambiguë, propose zéro action et explique-le dans summary.
- Date actuelle : ${new Date().toISOString().slice(0, 10)}.`;

  const user = `INSTRUCTION :
${instruction}

ÉTAT CRM :
${JSON.stringify(state)}${fileText ? `\n\nCONTENU DU FICHIER FOURNI :\n${fileText}` : "\n\nAUCUN FICHIER FOURNI : traite l’instruction uniquement avec l’état du CRM."}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.CRM_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-terra",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "OpenAI n’a pas pu préparer le plan.");
    error.statusCode = 502;
    throw error;
  }
  try {
    return parsePlan(extractOutputText(data));
  } catch (cause) {
    const error = new Error(cause.message || "L’agent n’a pas renvoyé un plan exploitable.");
    error.statusCode = 502;
    throw error;
  }
}

async function executeActions(actions) {
  const db = getAdminDb();
  const results = [];

  for (const action of actions.slice(0, 100)) {
    if (!ACTION_TYPES.has(action.type)) throw new Error(`Action non autorisée : ${action.type}`);

    if (action.type === "prospect.create") {
      const payload = cleanObject(action.payload, PROSPECT_FIELDS);
      if (!String(payload.name || "").trim()) throw new Error("Nom requis pour créer un prospect.");
      if (payload.pipelineStatus && !PIPELINE_STATUSES.has(payload.pipelineStatus)) {
        throw new Error("Statut pipeline invalide.");
      }
      const ref = await db.collection("prospects").add({
        ...payload,
        pipelineStatus: payload.pipelineStatus || "a_contacter",
        scoreTotal: 0,
        redFlags: [],
        autoExcluded: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({ type: action.type, id: ref.id, description: action.description });
      continue;
    }

    if (action.type === "prospect.update") {
      if (!action.targetId) throw new Error("Prospect cible manquant.");
      const patch = cleanObject(action.payload, PROSPECT_FIELDS);
      if (patch.pipelineStatus && !PIPELINE_STATUSES.has(patch.pipelineStatus)) {
        throw new Error("Statut pipeline invalide.");
      }
      await db.collection("prospects").doc(action.targetId).update({
        ...patch,
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({ type: action.type, id: action.targetId, description: action.description });
      continue;
    }

    if (action.type === "prospect.add_note") {
      if (!action.targetId) throw new Error("Prospect cible manquant.");
      const note = String(action.payload?.note || "").trim();
      if (!note) throw new Error("Note requise.");
      const ref = db.collection("prospects").doc(action.targetId);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Prospect introuvable.");
        const current = String(snapshot.data().notes || "").trim();
        transaction.update(ref, {
          notes: current ? `${current}\n\n${note}` : note,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      results.push({ type: action.type, id: action.targetId, description: action.description });
      continue;
    }

    if (action.type === "task.create") {
      const title = String(action.payload?.title || "").trim();
      if (!title) throw new Error("Titre requis pour créer une tâche.");
      const ref = await db.collection("tasks").add({
        title,
        dueDate: action.payload.dueDate || null,
        done: false,
        prospectId: action.payload.prospectId || null,
        prospectName: action.payload.prospectName || null,
        createdAt: FieldValue.serverTimestamp(),
      });
      results.push({ type: action.type, id: ref.id, description: action.description });
      continue;
    }

    if (action.type === "task.update" || action.type === "task.complete") {
      if (!action.targetId) throw new Error("Tâche cible manquante.");
      const patch = action.type === "task.complete"
        ? { done: true }
        : cleanObject(action.payload, TASK_FIELDS);
      await db.collection("tasks").doc(action.targetId).update(patch);
      results.push({ type: action.type, id: action.targetId, description: action.description });
      continue;
    }

    if (action.type === "session.create") {
      const { date, startTime, durationMinutes, prospectIds } = action.payload || {};
      if (!date || !startTime) throw new Error("Date et heure requises pour une session.");
      const ref = await db.collection("sessions").add({
        date,
        startTime,
        durationMinutes: Number(durationMinutes) || 60,
        prospectIds: Array.isArray(prospectIds) ? prospectIds : [],
        status: "planned",
      });
      results.push({ type: action.type, id: ref.id, description: action.description });
      continue;
    }

    if (action.type === "session.update") {
      if (!action.targetId) throw new Error("Session cible manquante.");
      const patch = cleanObject(action.payload, SESSION_FIELDS);
      if (patch.status && !SESSION_STATUSES.has(patch.status)) throw new Error("Statut de session invalide.");
      if (patch.durationMinutes !== undefined) patch.durationMinutes = Number(patch.durationMinutes) || 60;
      if (patch.prospectIds !== undefined && !Array.isArray(patch.prospectIds)) patch.prospectIds = [];
      await db.collection("sessions").doc(action.targetId).update(patch);
      results.push({ type: action.type, id: action.targetId, description: action.description });
      continue;
    }

    if (action.type === "settings.notifications.update") {
      const ruleId = String(action.payload?.ruleId || "");
      const allowed = SETTING_RULES[ruleId];
      if (!allowed) throw new Error("Réglage de notification inconnu.");
      const patch = cleanObject(action.payload?.patch, allowed);
      if (patch.enabled !== undefined) patch.enabled = Boolean(patch.enabled);
      for (const key of ["minutesBefore", "days", "threshold"]) {
        if (patch[key] !== undefined) patch[key] = Math.max(0, Number(patch[key]) || 0);
      }
      await db.collection("settings").doc("notifications").set({ [ruleId]: patch }, { merge: true });
      results.push({ type: action.type, id: ruleId, description: action.description });
      continue;
    }
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    await requireUser(req);
    const { instruction, fileText, execute, actions } = req.body || {};
    if (execute) {
      const results = await executeActions(Array.isArray(actions) ? actions : []);
      return res.status(200).json({ success: true, results });
    }
    if (!String(instruction || "").trim()) {
      return res.status(400).json({ error: "Écris une instruction pour l’agent." });
    }
    const plan = await buildPlan(String(instruction).slice(0, 8000), String(fileText || "").slice(0, 300000));
    return res.status(200).json(plan);
  } catch (error) {
    return sendApiError(res, error);
  }
}
