import { google } from "googleapis";
import { getAuthorizedClient, getStoredTokens, saveIntegrationDoc } from "./_googleClient.js";
import { getAdminDb } from "../_firebaseAdmin.js";
import { PIPELINE_STATUSES } from "../../src/config/pipeline.js";

const RANGE = "Prospects!A2:J";

function statusLabel(id) {
  return PIPELINE_STATUSES.find((s) => s.id === id)?.label || id;
}
function statusIdFromLabel(label) {
  return PIPELINE_STATUSES.find((s) => s.label === label)?.id;
}

function prospectToRowFields(p) {
  return {
    name: p.name || "",
    type: p.type || "",
    cityCanton: [p.city, p.canton].filter(Boolean).join(" / "),
    contact: [p.contactName, p.phone].filter(Boolean).join(" · "),
    score: String(p.scoreTotal ?? 0),
    offer: p.recommendation?.offerLabel || "",
    status: statusLabel(p.pipelineStatus),
    lastContact: p.lastContactDate?.toDate ? p.lastContactDate.toDate().toISOString().slice(0, 10) : "",
    notes: p.notes || "",
  };
}

function rowToFields(row) {
  const [, name, type, cityCanton, contact, score, offer, status, lastContact, notes] = row;
  return { name, type, cityCanton, contact, score, offer, status, lastContact, notes };
}

function fieldsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stored = await getStoredTokens();
  if (!stored?.spreadsheetId) {
    return res.status(400).json({ error: "Google Sheets non connecté. Clique sur 'Connecter mon compte Google' d'abord." });
  }

  const auth = await getAuthorizedClient(req);
  const sheets = google.sheets({ version: "v4", auth });
  const db = getAdminDb();

  const [sheetResp, prospectsSnap] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: stored.spreadsheetId, range: RANGE }),
    db.collection("prospects").get(),
  ]);

  const sheetRows = sheetResp.data.values || [];
  const rowSyncState = stored.rowSyncState || {};
  const prospectsById = new Map(prospectsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const sheetRowById = new Map(sheetRows.map((row, i) => [row[0], { row, index: i }]));

  const conflicts = [];
  const sheetUpdates = []; // { rowIndex (0-based in data range), values }
  const newSheetRows = [];
  const newRowSyncState = { ...rowSyncState };
  let pulledCount = 0;

  for (const [id, prospect] of prospectsById) {
    const crmUpdatedAtMs = prospect.updatedAt?.toMillis ? prospect.updatedAt.toMillis() : 0;
    const crmFields = prospectToRowFields(prospect);
    const sheetEntry = sheetRowById.get(id);

    if (!sheetEntry) {
      // Nouveau prospect côté CRM -> ajouter une ligne.
      newSheetRows.push([id, crmFields.name, crmFields.type, crmFields.cityCanton, crmFields.contact, crmFields.score, crmFields.offer, crmFields.status, crmFields.lastContact, crmFields.notes]);
      newRowSyncState[id] = { crmUpdatedAtMs, sheetSnapshot: crmFields };
      continue;
    }

    const sheetFields = rowToFields(sheetEntry.row);
    const state = rowSyncState[id];
    const crmChanged = !state || state.crmUpdatedAtMs !== crmUpdatedAtMs;
    const sheetChanged = !state || !fieldsEqual(sheetFields, state.sheetSnapshot);

    if (crmChanged && sheetChanged) {
      conflicts.push({
        id,
        name: prospect.name,
        sheetRowIndex: sheetEntry.index,
        crmVersion: crmFields,
        sheetVersion: sheetFields,
      });
      continue;
    }

    if (crmChanged) {
      sheetUpdates.push({ rowIndex: sheetEntry.index, values: [id, crmFields.name, crmFields.type, crmFields.cityCanton, crmFields.contact, crmFields.score, crmFields.offer, crmFields.status, crmFields.lastContact, crmFields.notes] });
      newRowSyncState[id] = { crmUpdatedAtMs, sheetSnapshot: crmFields };
      continue;
    }

    if (sheetChanged) {
      // On ne rapatrie que les champs éditables depuis Sheets : statut, notes, contact, date dernier contact.
      // Nom/Type/Ville/Score/Prestation restent calculés/gérés côté CRM.
      const patch = {};
      const newStatus = statusIdFromLabel(sheetFields.status);
      if (newStatus && newStatus !== prospect.pipelineStatus) patch.pipelineStatus = newStatus;
      if (sheetFields.notes !== prospect.notes) patch.notes = sheetFields.notes;
      if (Object.keys(patch).length) {
        await db.collection("prospects").doc(id).update({ ...patch, updatedAt: new Date() });
        pulledCount++;
      }
      newRowSyncState[id] = { crmUpdatedAtMs: patch.updatedAt ? Date.now() : crmUpdatedAtMs, sheetSnapshot: sheetFields };
    }
  }

  // Lignes présentes dans Sheets mais avec un ID inconnu du CRM (ajoutées à la main, ou prospect supprimé) : ignorées pour l'instant.

  if (sheetUpdates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: stored.spreadsheetId,
      requestBody: {
        data: sheetUpdates.map((u) => ({ range: `Prospects!A${u.rowIndex + 2}:J${u.rowIndex + 2}`, values: [u.values] })),
        valueInputOption: "RAW",
      },
    });
  }

  if (newSheetRows.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: stored.spreadsheetId,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: { values: newSheetRows },
    });
  }

  await saveIntegrationDoc({ rowSyncState: newRowSyncState });

  res.status(200).json({
    pushed: sheetUpdates.length + newSheetRows.length,
    pulled: pulledCount,
    conflicts,
  });
}
