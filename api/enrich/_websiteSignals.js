// Aide partagée : récupère un extrait borné (taille + timeout) du site d'un
// prospect et en extrait des signaux exploitables par l'IA pour juger si le
// site est vide/cassé/dépassé — sans crawl, sans rendu JS, donc pas cher.
// Utilisé par api/enrich/analyze.js (au moment de la recherche) et
// api/enrich/check-website.js (re-vérification après import).

const MAX_BYTES = 20000;
const FETCH_TIMEOUT_MS = 6000;

const PARKED_PATTERNS = [
  /domain (is |may be )?for sale/i,
  /this domain (is|has been) (parked|registered)/i,
  /buy this domain/i,
  /domaine (est )?à vendre/i,
  /acheter ce domaine/i,
  /godaddy\.com\/domains/i,
  /sedo\.com/i,
  /parkingcrew/i,
];

const PLACEHOLDER_PATTERNS = [
  /coming soon/i,
  /under construction/i,
  /en construction/i,
  /site en cours/i,
  /page par défaut/i,
  /default web site page/i,
  /apache2 (ubuntu )?default page/i,
  /welcome to nginx/i,
  /index of \//i,
];

export function normalizeUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function fetchSnippet(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AWC-CRM-Bot/1.0)" },
    });
    if (!resp.ok || !resp.body) return { html: null, status: resp.status };
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
    return { html, status: resp.status };
  } catch {
    return { html: null, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractVisibleText(html) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

// Extrait les signaux : quelques méta-infos techniques + un échantillon de
// texte visible (assez pour qu'un modèle langage juge la qualité réelle du
// contenu, pas seulement des heuristiques de balises).
export function extractSignals(html) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 80) || null;
  const generator = html.match(/name=["']generator["']\s+content=["']([^"']*)["']/i)?.[1]?.slice(0, 40) || null;
  const hasViewportMeta = /name=["']viewport["']/i.test(html);
  const copyrightYear = html.match(/(?:©|copyright)[^\d]{0,10}(19|20)\d{2}/i)?.[0]?.match(/(19|20)\d{2}/)?.[0] || null;
  const visibleText = extractVisibleText(html);
  const textSample = visibleText.slice(0, 300);
  const textLength = visibleText.length;
  const looksParked = PARKED_PATTERNS.some((re) => re.test(html));
  const looksPlaceholder = PLACEHOLDER_PATTERNS.some((re) => re.test(html));
  return {
    title,
    generator,
    hasViewportMeta,
    copyrightYear,
    textSample,
    textLength,
    looksParked,
    looksPlaceholder,
  };
}

// Récupère + extrait en une passe pour une URL brute (retourne null si
// injoignable/erreur, sans jeter — laisse l'appelant décider quoi en faire).
export async function getWebsiteSignals(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { reachable: false, reason: "URL invalide" };
  const { html, status } = await fetchSnippet(url);
  if (html == null) {
    return { reachable: false, reason: status ? `HTTP ${status}` : "Site inaccessible/timeout" };
  }
  return { reachable: true, signals: extractSignals(html) };
}
