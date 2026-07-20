import { google } from "googleapis";
import { getAuthorizedClient, getStoredTokens, saveIntegrationDoc } from "./_googleClient.js";
import { getAdminDb } from "../_firebaseAdmin.js";
import { PIPELINE_STATUSES } from "../../src/config/pipeline.js";

function statusIdFromLabel(label) {
  return PIPELINE_STATUSES.find((s) => s.label === label)?.id;
}

// Résout un conflit détecté par /api/sheets/sync en appliquant explicitement
// la version choisie par l'utilisateur ("crm" ou "sheet") — jamais d'écrasement automatique.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prospectId, keep, sheetRowIndex, crmFields, sheetFields } = req.body;

  try {
    const stored = await getStoredTokens();
    const auth = await getAuthorizedClient(req);
    const sheets = google.sheets({ version: "v4", auth });
    const db = getAdminDb();

    if (keep === "crm") {
      await sheets.spreadsheets.values.update({
        spreadsheetId: stored.spreadsheetId,
        range: `Prospects!A${sheetRowIndex + 2}:J${sheetRowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[prospectId, crmFields.name, crmFields.type, crmFields.cityCanton, crmFields.contact, crmFields.score, crmFields.offer, crmFields.status, crmFields.lastContact, crmFields.notes]] },
      });
      await saveIntegrationDoc({ [`rowSyncState.${prospectId}`]: { sheetSnapshot: crmFields } });
    } else {
      const patch = {};
      const newStatus = statusIdFromLabel(sheetFields.status);
      if (newStatus) patch.pipelineStatus = newStatus;
      patch.notes = sheetFields.notes;
      await db.collection("prospects").doc(prospectId).update({ ...patch, updatedAt: new Date() });
      await saveIntegrationDoc({ [`rowSyncState.${prospectId}`]: { sheetSnapshot: sheetFields } });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("sheets/resolve error:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la résolution du conflit." });
  }
}
