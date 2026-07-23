import { del } from "@vercel/blob";
import { requireUser, sendApiError } from "../_apiAuth.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    const user = await requireUser(req);
    const pathname = String(req.body?.pathname || "");
    if (!pathname.startsWith(`crm/${user.uid}/`)) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    await del(pathname);
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendApiError(res, error);
  }
}
