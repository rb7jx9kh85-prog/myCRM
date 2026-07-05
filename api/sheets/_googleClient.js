import { google } from "googleapis";
import { getAdminDb } from "../_firebaseAdmin";

export function getRedirectUri(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}/api/sheets/callback`;
}

export function getOAuthClient(req) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );
}

export async function getStoredTokens() {
  const db = getAdminDb();
  const snap = await db.collection("integrations").doc("googleSheets").get();
  return snap.exists ? snap.data() : null;
}

export async function saveIntegrationDoc(patch) {
  const db = getAdminDb();
  await db.collection("integrations").doc("googleSheets").set(patch, { merge: true });
}

export async function getAuthorizedClient(req) {
  const stored = await getStoredTokens();
  if (!stored?.refreshToken) return null;

  const oauth2Client = getOAuthClient(req);
  oauth2Client.setCredentials({
    refresh_token: stored.refreshToken,
    access_token: stored.accessToken,
    expiry_date: stored.expiryDate,
  });

  oauth2Client.on("tokens", async (tokens) => {
    const patch = {};
    if (tokens.access_token) patch.accessToken = tokens.access_token;
    if (tokens.expiry_date) patch.expiryDate = tokens.expiry_date;
    if (Object.keys(patch).length) await saveIntegrationDoc(patch);
  });

  return oauth2Client;
}
