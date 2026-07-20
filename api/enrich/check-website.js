// Vérification légère des sites web des prospects, en un seul lot et
// économique en tokens : pas de crawl ni de recherche web, juste un fetch
// borné (taille + timeout) par site pour extraire quelques signaux
// techniques (titre, meta generator, balise viewport, année de copyright),
// puis UN SEUL appel IA classe tous les sites du lot d'un coup avec un
// modèle bon marché (gpt-3.5-turbo par défaut).
const MODEL = process.env.OPENAI_MODEL_WEBSITE_CHECK || "gpt-3.5-turbo";
const MAX_BYTES = 20000;
const FETCH_TIMEOUT_MS = 6000;

function normalizeUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchSnippet(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!resp.ok || !resp.body) return null;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      received += value.length;
    }
    reader.cancel().catch(() => {});
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractSignals(html) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 80) || null;
  const generator = html.match(/name=["']generator["']\s+content=["']([^"']*)["']/i)?.[1]?.slice(0, 40) || null;
  const hasViewportMeta = /name=["']viewport["']/i.test(html);
  const copyrightYear = html.match(/(?:©|copyright)[^\d]{0,10}(19|20)\d{2}/i)?.[0]?.match(/(19|20)\d{2}/)?.[0] || null;
  return { title, generator, hasViewportMeta, copyrightYear };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY manquante côté serveur." });

  const { items } = req.body; // [{ id, website }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Aucun site à vérifier." });
  }

  try {
    const snippets = await Promise.all(
      items.map(async (item) => {
        const url = normalizeUrl(item.website);
        if (!url) return { id: item.id, unreachable: true, reason: "URL invalide" };
        const html = await fetchSnippet(url);
        if (html == null) return { id: item.id, unreachable: true, reason: "Site inaccessible" };
        return { id: item.id, signals: extractSignals(html) };
      })
    );

    const reachable = snippets.filter((s) => !s.unreachable);
    const unreachable = snippets.filter((s) => s.unreachable);

    let aiResults = [];
    if (reachable.length) {
      const userContent = JSON.stringify(reachable.map((s, index) => ({ index, ...s.signals })));

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
                'Tu évalues si un site web semble ancien/dépassé à partir de quelques signaux techniques ' +
                '(titre, meta generator, présence d\'une balise viewport, année de copyright trouvée). ' +
                'Pas d\'accès internet, juge uniquement sur ces signaux fournis. ' +
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

    const results = reachable.map((s, index) => {
      const match = aiResults.find((r) => r.index === index);
      return {
        id: s.id,
        status: match?.oldWebsite ? "ancien" : "moderne",
        oldWebsite: !!match?.oldWebsite,
        reasoning: match?.reasoning || "",
      };
    });

    unreachable.forEach((s) => {
      results.push({ id: s.id, status: "injoignable", oldWebsite: false, reasoning: s.reason });
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error("enrich/check-website error:", err);
    return res.status(500).json({ error: err.message || "Échec de la vérification des sites web." });
  }
}
