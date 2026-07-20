// Génère, pour un lot de prospects (une session de cold call), une phrase
// d'accroche et un angle de pain point par prospect — un seul appel IA pour
// tout le lot, réutilise le profil ICP (src/config/icpProfile.js) déjà
// utilisé par l'enrichissement de recherche.
import { buildSystemPrompt } from "../../src/config/icpProfile.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY manquante côté serveur." });

  const { prospects } = req.body; // [{ id, name, type, city, scoreTotal, redFlags, offerLabel, notes }]
  if (!Array.isArray(prospects) || prospects.length === 0) {
    return res.status(400).json({ error: "Aucun prospect fourni." });
  }

  const userContent = JSON.stringify(
    prospects.map((p, index) => ({
      index,
      name: p.name,
      type: p.type,
      city: p.city,
      scoreTotal: p.scoreTotal,
      redFlags: p.redFlags || [],
      offerLabel: p.offerLabel || null,
      notes: p.notes || null,
    }))
  );

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              buildSystemPrompt() +
              '\n\nTu génères maintenant, pour chaque prospect fourni, une phrase d\'accroche (moins de 25 mots, en français, naturelle pour un appel à froid) et un angle de pain point à exploiter pendant l\'appel (moins de 20 mots). Réponds strictement en JSON : {"results":[{"index":0,"opener":"...","angle":"..."}]}',
          },
          { role: "user", content: `Génère les angles d'appel pour ces prospects :\n${userContent}` },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return res.status(502).json({ error: `Erreur OpenAI: ${errText}` });
    }
    const data = await openaiRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return res.status(200).json({ results: parsed.results || [] });
  } catch (err) {
    console.error("enrich/call-angles error:", err);
    return res.status(500).json({ error: err.message || "Échec de la génération des angles d'appel." });
  }
}
