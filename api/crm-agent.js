import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./_firebaseAdmin.js";
import { requireUser, sendApiError } from "./_apiAuth.js";

const PROSPECT_FIELDS = new Set([
  "name", "type", "canton", "city", "address", "contactName", "phone", "email",
  "website", "pipelineStatus", "notes", "needsReservation", "strongVisualIdentity",
  "multiLocation", "criteria", "nextCallDate",
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
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.actions)) throw new Error("Plan IA invalide.");
  return {
    summary: String(parsed.summary || "Plan proposé par l’agent."),
    actions: parsed.actions.slice(0, 100).map((action) => ({
      type: String(action.type || ""),
      targetId: action.targetId ? String(action.targetId) : null,
      description: String(action.description || action.type || "Action CRM"),
      payload: action.payload && typeof action.payload === "object" ? action.payload : {},
    })),
  };
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
    tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    sessions: sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };

  const system = `Tu es l’agent opérationnel du CRM Alpinia Web Craft.
Tu transformes une instruction en actions CRM précises. Tu ne réponds qu’en JSON valide, sans markdown.

Format obligatoire :
{"summary":"résumé bref en français","actions":[{"type":"prospect.create|prospect.update|task.create|session.create","targetId":"id ou null","description":"description lisible","payload":{}}]}

Règles :
- N’invente jamais un targetId : utilise exactement un id présent dans l’état CRM.
- prospect.create payload : name obligatoire, puis type, canton, city, address, contactName, phone, email, website, pipelineStatus, notes, criteria si disponibles.
- prospect.update payload : uniquement les champs à changer.
- task.create payload : title obligatoire, dueDate au format YYYY-MM-DD ou null, prospectId/prospectName si lié.
- session.create payload : date YYYY-MM-DD, startTime HH:mm, durationMinutes, prospectIds.
- Pour “tous les prospects où il y a 💸”, utilise uniquement les lignes du fichier qui contiennent réellement 💸.
- Ne supprime jamais de données. Si l’instruction est ambiguë, propose zéro action et explique-le dans summary.
- Date actuelle : ${new Date().toISOString().slice(0, 10)}.`;

  const user = `INSTRUCTION :
${instruction}

ÉTAT CRM :
${JSON.stringify(state)}

CONTENU DU FICHIER ÉVENTUEL :
${fileText || "(aucun fichier texte fourni)"}`;

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
      text: { format: { type: "json_object" } },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "OpenAI n’a pas pu préparer le plan.");
    error.statusCode = 502;
    throw error;
  }
  return parsePlan(extractOutputText(data));
}

async function executeActions(actions) {
  const db = getAdminDb();
  const results = [];

  for (const action of actions.slice(0, 100)) {
    if (action.type === "prospect.create") {
      const payload = cleanObject(action.payload, PROSPECT_FIELDS);
      if (!String(payload.name || "").trim()) throw new Error("Nom requis pour créer un prospect.");
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
      await db.collection("prospects").doc(action.targetId).update({
        ...patch,
        updatedAt: FieldValue.serverTimestamp(),
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

    throw new Error(`Action non autorisée : ${action.type}`);
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
