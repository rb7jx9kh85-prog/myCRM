// Enrichissement IA des prospects trouvés via Geoapify — UN SEUL appel
// OpenAI (gpt-5.6-luna, le tier le moins cher) qui fait à la fois :
//  - le scoring ICP (voir src/config/icpProfile.js)
//  - le jugement réel du site web (extrait de texte visible, pas juste des
//    méta-signaux — voir _websiteSignals.js), pas de coût IA supplémentaire
//    puisque tout est envoyé dans le même prompt.
// Le statut "fermé définitivement" (googleMapsStatus) est optionnel et
// gratuit en tokens IA : vérifié côté serveur via l'API Google Places
// (_googlePlacesStatus.js, nécessite GOOGLE_PLACES_API_KEY) et exclu avant
// même d'atteindre l'IA quand confirmé — Geoapify/OSM n'a pas cette info.
// Cible : <0.02$ pour un lot de 20 prospects.
import { buildSystemPrompt } from "../../src/config/icpProfile.js";
import { getWebsiteSignals } from "./_websiteSignals.js";
import { getClosedStatuses } from "./_googlePlacesStatus.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY manquante côté serveur." });

  const { candidates } = req.body; // [{ name, type, city, address, phone, website, category }]
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: "Aucun candidat fourni." });
  }

  try {
    // 1) Statut Google Maps (optionnel, gratuit en tokens IA) — en parallèle
    //    du fetch des sites, aucune dépendance entre les deux.
    const [closedStatuses, websiteSignalsList] = await Promise.all([
      getClosedStatuses(candidates.map((c, index) => ({ id: index, name: c.name, address: c.address, city: c.city }))),
      Promise.all(
        candidates.map((c) => (c.website ? getWebsiteSignals(c.website) : Promise.resolve(null)))
      ),
    ]);

    // 2) Exclusion immédiate, sans passer par l'IA, pour les fermetures
    //    définitives confirmées — économise des tokens et garantit
    //    l'exclusion (pas d'aléa de génération sur ce point critique).
    const preExcludedIndexes = new Set();
    const results = [];
    candidates.forEach((c, index) => {
      const status = closedStatuses.byId[index];
      if (status === "CLOSED_PERMANENTLY") {
        preExcludedIndexes.add(index);
        results.push({
          index,
          verdict: "exclure",
          redFlags: ["closedPermanently"],
          suggestedCriteria: { noWebsite: !c.website, oldWebsite: null },
          suggestedNeedsReservation: null,
          suggestedStrongVisualIdentity: null,
          suggestedOfferId: null,
          reasoning: "Fermé définitivement sur Google Maps.",
        });
      }
    });

    const toAnalyze = candidates
      .map((c, index) => ({ c, index }))
      .filter(({ index }) => !preExcludedIndexes.has(index));

    if (toAnalyze.length === 0) {
      return res.status(200).json({ results });
    }

    const userContent = JSON.stringify(
      toAnalyze.map(({ c, index }) => {
        const ws = websiteSignalsList[index];
        const entry = {
          index,
          name: c.name,
          type: c.type,
          city: c.city,
          address: c.address,
          phone: c.phone || null,
          geoapifyCategory: c.category || null,
          hasWebsite: !!c.website,
        };
        if (ws?.reachable) entry.websiteSignals = ws.signals;
        else if (ws && !ws.reachable) {
          entry.websiteUnreachable = true;
          entry.websiteUnreachableReason = ws.reason;
        }
        const status = closedStatuses.byId[index];
        if (status) entry.googleMapsStatus = status;
        return entry;
      })
    );

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
    const aiResults = parsed.results || [];

    return res.status(200).json({
      results: [...results, ...aiResults],
      googleMapsChecked: closedStatuses.checked,
    });
  } catch (err) {
    console.error("enrich/analyze error:", err);
    return res.status(502).json({ error: err.message || "Échec de l'appel OpenAI." });
  }
}
