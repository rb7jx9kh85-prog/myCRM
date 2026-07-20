// Vérification optionnelle du statut "fermé définitivement" via l'API Google
// Places — Geoapify (basé sur OpenStreetMap) n'a pas d'équivalent fiable au
// business_status de Google Maps, donc cette info ne peut venir que de là.
//
// Complètement optionnel et dégradé gracieusement : si GOOGLE_PLACES_API_KEY
// n'est pas défini dans les variables d'env Vercel, cette vérification est
// simplement sautée (aucun candidat n'est jamais exclu à tort). C'est un
// coût séparé de celui d'OpenAI (facturé par Google, pas inclus dans le
// budget IA) — à activer volontairement si tu veux ce filtre strict.
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const FETCH_TIMEOUT_MS = 5000;

async function lookupOne(apiKey, candidate) {
  const input = [candidate.name, candidate.address || candidate.city].filter(Boolean).join(", ");
  if (!input) return { id: candidate.id, businessStatus: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${FIND_PLACE_URL}?input=${encodeURIComponent(input)}&inputtype=textquery&fields=business_status&key=${apiKey}`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return { id: candidate.id, businessStatus: null };
    const data = await r.json();
    const status = data.candidates?.[0]?.business_status || null;
    return { id: candidate.id, businessStatus: status };
  } catch {
    return { id: candidate.id, businessStatus: null };
  } finally {
    clearTimeout(timeout);
  }
}

// candidates: [{ id, name, address, city }] -> Map<id, "OPERATIONAL"|"CLOSED_TEMPORARILY"|"CLOSED_PERMANENTLY"|null>
export async function getClosedStatuses(candidates) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !candidates.length) return { checked: false, byId: {} };
  const results = await Promise.all(candidates.map((c) => lookupOne(apiKey, c)));
  const byId = Object.fromEntries(results.map((r) => [r.id, r.businessStatus]));
  return { checked: true, byId };
}
