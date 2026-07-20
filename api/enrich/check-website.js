// Re-vérification en bundle des sites web des prospects déjà importés
// (écran Prospects). Réutilise _websiteSignals.js (même extraction que la
// recherche) puis UN SEUL appel IA classe tous les sites du lot d'un coup
// avec le modèle bon marché gpt-5.6-luna.
import { getWebsiteSignals } from "./_websiteSignals.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY manquante côté serveur." });

  const { items } = req.body; // [{ id, website }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Aucun site à vérifier." });
  }

  try {
    const checks = await Promise.all(
      items.map(async (item) => ({ id: item.id, ...(await getWebsiteSignals(item.website)) }))
    );

    const reachable = checks.filter((c) => c.reachable);
    const unreachable = checks.filter((c) => !c.reachable);

    let aiResults = [];
    if (reachable.length) {
      const userContent = JSON.stringify(reachable.map((c, index) => ({ index, ...c.signals })));

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Tu juges si un site web semble vide, cassé, dépassé ou nul à partir d'un extrait réel de son " +
                "contenu (titre, extrait de texte visible réellement présent, longueur du texte, balise viewport, " +
                "année de copyright, looksParked = domaine parqué, looksPlaceholder = page par défaut/en construction). " +
                "oldWebsite=true si vide/cassé/parqué/placeholder/texte dérisoire/design visiblement daté (2010-2020, pas de viewport). " +
                'Réponds strictement en JSON : {"results":[{"index":0,"oldWebsite":true,"reasoning":"raison en moins de 12 mots"}]}',
            },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return res.status(502).json({ error: `Erreur OpenAI: ${errText}` });
      }
      const data = await openaiRes.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      aiResults = parsed.results || [];
    }

    const results = reachable.map((c, index) => {
      const match = aiResults.find((r) => r.index === index);
      return {
        id: c.id,
        status: match?.oldWebsite ? "ancien" : "moderne",
        oldWebsite: !!match?.oldWebsite,
        reasoning: match?.reasoning || "",
      };
    });

    unreachable.forEach((c) => {
      results.push({ id: c.id, status: "injoignable", oldWebsite: false, reasoning: c.reason });
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error("enrich/check-website error:", err);
    return res.status(500).json({ error: err.message || "Échec de la vérification des sites web." });
  }
}
