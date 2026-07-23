import { put, get, del } from "@vercel/blob";
import { requireUser, sendApiError } from "./_apiAuth.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function safeName(value) {
  return String(value || "fichier")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "fichier";
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_FILE_SIZE) {
      const error = new Error("Le fichier dépasse la limite de 2 Mo.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function upload(req, res, user) {
  const declaredSize = Number(req.headers["content-length"] || 0);
  if (declaredSize > MAX_FILE_SIZE) {
    return res.status(413).json({ error: "Le fichier dépasse la limite de 2 Mo." });
  }

  const filename = safeName(decodeURIComponent(req.headers["x-file-name"] || "fichier"));
  const prospectId = safeName(req.headers["x-prospect-id"] || "sans-prospect");
  const contentType = String(req.headers["content-type"] || "application/octet-stream");
  const body = await readBody(req);
  if (!body.length) return res.status(400).json({ error: "Fichier vide." });

  const blob = await put(`crm/${user.uid}/${prospectId}/${filename}`, body, {
    access: "private",
    addRandomSuffix: true,
    contentType,
  });

  return res.status(200).json({
    name: filename,
    pathname: blob.pathname,
    contentType,
    size: body.length,
    uploadedAt: new Date().toISOString(),
  });
}

async function download(req, res, user) {
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
}

async function remove(req, res, user) {
  const pathname = String(req.body?.pathname || "");
  if (!pathname.startsWith(`crm/${user.uid}/`)) {
    return res.status(403).json({ error: "Accès refusé." });
  }
  await del(pathname);
  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method === "POST") return upload(req, res, user);
    if (req.method === "GET") return download(req, res, user);
    if (req.method === "DELETE") return remove(req, res, user);
    return res.status(405).json({ error: "Méthode non autorisée." });
  } catch (error) {
    return sendApiError(res, error);
  }
}
