// Enrichissement IA des prospects trouvés via Geoapify — appelle OpenAI
// avec un system prompt hyper détaillé sur AWC et ton ICP (voir
// src/config/icpProfile.js). La clé OPENAI_API_KEY reste côté serveur.
import { buildSystemPrompt } from "../../src/config/icpProfile";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY manquante côté serveur." });

  const { candidates } = req.body; // [{ name, type, city, address, phone, website, category }]
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: "Aucun candidat fourni." });
  }

  const userContent = JSON.stringify(
    candidates.map((c, index) => ({
      index,
      name: c.name,
      type: c.type,
      city: c.city,
      address: c.address,
      phone: c.phone || null,
      website: c.website || null,
      hasWebsite: !!c.website,
      geoapifyCategory: c.category || null,
    }))
  );

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: `Analyse ces prospects et réponds au format JSON demandé :\n${userContent}` },
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
  } catch {
    return res.status(502).json({ error: "Échec de l'appel OpenAI." });
  }
}
