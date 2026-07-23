import { getAdminAuth } from "./_firebaseAdmin.js";

export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const error = new Error("Authentification requise.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    const error = new Error("Session invalide ou expirée.");
    error.statusCode = 401;
    throw error;
  }
}

export function sendApiError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({ error: status === 500 ? "Erreur serveur." : error.message });
}
