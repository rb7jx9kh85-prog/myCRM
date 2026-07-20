// Complète le téléphone/site web manquants pour des résultats Geoapify —
// la recherche Places renvoie parfois des fiches incomplètes ; l'API Place
// Details, avec le même identifiant (place_id) et la même clé, renvoie
// souvent plus de détails. Aucun coût IA, juste un appel Geoapify de plus
// par fiche incomplète.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEOAPIFY_API_KEY manquante côté serveur." });

  const { ids } = req.body; // [place_id, ...]
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Aucun identifiant fourni." });
  }

  try {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const url = `https://api.geoapify.com/v2/place-details?id=${encodeURIComponent(id)}&apiKey=${apiKey}`;
          const r = await fetch(url);
          if (!r.ok) return { id, phone: null, website: null };
          const data = await r.json();
          const props = data.features?.[0]?.properties;
          return {
            id,
            phone: props?.contact?.phone || props?.datasource?.raw?.phone || null,
            website: props?.website || props?.contact?.website || null,
          };
        } catch {
          return { id, phone: null, website: null };
        }
      })
    );
    return res.status(200).json({ results });
  } catch (err) {
    console.error("geoapify/place-details error:", err);
    return res.status(500).json({ error: err.message || "Échec de la récupération des détails." });
  }
}
