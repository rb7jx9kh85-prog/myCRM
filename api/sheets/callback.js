import { google } from "googleapis";
import { getOAuthClient, saveIntegrationDoc, getStoredTokens } from "./_googleClient.js";

const HEADER_ROW = [
  "ID",
  "Nom établissement",
  "Type",
  "Ville/Canton",
  "Contact",
  "Score ICP",
  "Prestation recommandée",
  "Statut pipeline",
  "Date dernier contact",
  "Notes",
];

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send("Code OAuth manquant.");

  try {
    const oauth2Client = getOAuthClient(req);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const existing = await getStoredTokens();
    let spreadsheetId = existing?.spreadsheetId;

    if (!spreadsheetId) {
      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: "AWC CRM — Prospects" },
          sheets: [{ properties: { title: "Prospects" } }],
        },
      });
      spreadsheetId = created.data.spreadsheetId;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Prospects!A1:J1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
    }

    await saveIntegrationDoc({
      refreshToken: tokens.refresh_token || existing?.refreshToken,
      accessToken: tokens.access_token,
      expiryDate: tokens.expiry_date,
      spreadsheetId,
      rowSyncState: existing?.rowSyncState || {},
    });

    res.redirect("/reglages?sheets=connected");
  } catch (err) {
    console.error("sheets/callback error:", err);
    res.status(500).send(`Erreur lors de la connexion Google Sheets : ${err.message || "erreur inconnue"}`);
  }
}
