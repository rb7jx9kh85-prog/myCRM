import { get } from "@vercel/blob";
import { requireUser, sendApiError } from "../_apiAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    const user = await requireUser(req);
    const pathname = String(req.query.pathname || "");
    if (!pathname.startsWith(`crm/${user.uid}/`)) {
      return res.status(403).json({ error: "Accès refusé." });
    }

    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ error: "Fichier introuvable." });
    }
    const bytes = await new Response(result.stream).arrayBuffer();
    res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return sendApiError(res, error);
  }
}
