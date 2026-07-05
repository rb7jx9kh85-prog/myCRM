// Proxy serverless vers Geoapify Places API — la clé reste côté serveur
// (GEOAPIFY_API_KEY, à définir dans Vercel > Settings > Environment Variables).

// Centre approximatif par canton (chef-lieu). Le rayon est appliqué autour
// de ce point — pour un canton entier, augmente radiusKm si besoin.
const CANTON_CENTERS = {
  Valais: { lat: 46.2276, lon: 7.3597 },
  Vaud: { lat: 46.5197, lon: 6.6323 },
  Fribourg: { lat: 46.8065, lon: 7.162 },
  Genève: { lat: 46.2044, lon: 6.1432 },
  "Neuchâtel": { lat: 46.99, lon: 6.9293 },
  Jura: { lat: 47.3667, lon: 7.3333 },
};

// Catégories Geoapify Places par type d'établissement.
// À vérifier/ajuster sur https://apidocs.geoapify.com/docs/places/#categories
// si les résultats semblent incomplets ou hors-sujet.
const TYPE_CATEGORIES = {
  restaurant: "catering.restaurant",
  coiffeur_barber: "service.hairdresser",
  bar_cafe: "catering.cafe,catering.bar",
  cave_pme: "commercial.food_and_drink",
  boutique: "commercial",
};

export default async function handler(req, res) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEOAPIFY_API_KEY manquante côté serveur." });
  }

  const { canton, type, radiusKm = 15 } = req.query;
  const center = CANTON_CENTERS[canton];
  const category = TYPE_CATEGORIES[type];
  if (!center || !category) {
    return res.status(400).json({ error: "Canton ou type invalide." });
  }

  const radiusMeters = Number(radiusKm) * 1000;
  const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(category)}&filter=circle:${center.lon},${center.lat},${radiusMeters}&bias=proximity:${center.lon},${center.lat}&limit=50&apiKey=${apiKey}`;

  try {
    const geoRes = await fetch(url);
    const data = await geoRes.json();

    const results = (data.features || []).map((f) => {
      const p = f.properties;
      return {
        id: p.place_id,
        name: p.name || p.address_line1 || "Sans nom",
        city: p.city || p.county || "",
        address: p.formatted || "",
        phone: p.contact?.phone || "",
        website: p.website || p.contact?.website || "",
        category: (p.categories || []).join(", "),
      };
    });

    return res.status(200).json({ results });
  } catch {
    return res.status(502).json({ error: "Échec de la requête Geoapify." });
  }
}
