import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeScore } from "./scoring";
import { recommend, OFFERS } from "../config/recommendationEngine";
import { recordProspectVersion } from "./prospectHistory";

const prospectsCol = collection(db, "prospects");

// Recalcule score + red flags + recommandation à partir des critères saisis,
// et renvoie l'objet prospect complet prêt à être écrit dans Firestore.
// `aiSuggestedOfferId` (optionnel, retiré du payload stocké) sert de filet :
// si le moteur de règles ne tranche pas ("à qualifier manuellement"), on
// reprend la suggestion IA calculée à l'enrichissement plutôt que de laisser
// l'offre vide — visible comme telle via `recommendation.source`.
export function buildProspectPayload(input) {
  const { aiSuggestedOfferId, ...rest } = input;
  const { total, redFlags, autoExcluded } = computeScore(rest.criteria || {});
  const ruleResult = recommend(rest, total, autoExcluded);

  let offer = ruleResult.offer;
  let reason = ruleResult.reason;
  let source = "rules";

  if (!offer && !autoExcluded && aiSuggestedOfferId) {
    const aiOffer = Object.values(OFFERS).find((o) => o.id === aiSuggestedOfferId);
    if (aiOffer) {
      offer = aiOffer;
      reason = "Suggestion IA (ciblage automatique) — à confirmer manuellement.";
      source = "ai";
    }
  }

  return {
    ...rest,
    scoreTotal: total,
    redFlags,
    autoExcluded,
    recommendation: { offerId: offer?.id ?? null, offerLabel: offer?.label ?? null, reason, source },
  };
}

export function subscribeProspects(callback) {
  const q = query(prospectsCol, orderBy("scoreTotal", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createProspect(input) {
  const payload = buildProspectPayload(input);
  const ref = await addDoc(prospectsCol, {
    ...payload,
    pipelineStatus: input.pipelineStatus || "a_contacter",
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(ref.id, payload, "created");
  return ref;
}

export async function updateProspect(id, input) {
  const payload = buildProspectPayload(input);
  const ref = doc(db, "prospects", id);
  const previous = await getDoc(ref);
  const result = await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(id, previous.exists() ? previous.data() : input, "updated");
  return result;
}

export async function deleteProspect(id) {
  const ref = doc(db, "prospects", id);
  const previous = await getDoc(ref);
  const result = await updateDoc(ref, {
    archived: true,
    archivedReason: "Archivé depuis la fiche prospect.",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(id, previous.exists() ? previous.data() : {}, "archived");
  return result;
}

export async function addProspectAttachment(id, attachment) {
  const ref = doc(db, "prospects", id);
  const previous = await getDoc(ref);
  const result = await updateDoc(ref, {
    attachments: arrayUnion(attachment),
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(id, previous.exists() ? previous.data() : {}, "attachment_added");
  return result;
}

export async function removeProspectAttachment(id, attachment) {
  const ref = doc(db, "prospects", id);
  const previous = await getDoc(ref);
  const result = await updateDoc(ref, {
    attachments: arrayRemove(attachment),
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(id, previous.exists() ? previous.data() : {}, "attachment_removed");
  return result;
}

export async function logCallOutcome(id, nextStatus, callbackDate) {
  const ref = doc(db, "prospects", id);
  const previous = await getDoc(ref);
  const result = await updateDoc(ref, {
    pipelineStatus: nextStatus,
    lastContactDate: serverTimestamp(),
    ...(callbackDate ? { nextCallDate: callbackDate } : {}),
    updatedAt: serverTimestamp(),
  });
  await recordProspectVersion(id, previous.exists() ? previous.data() : {}, "call_outcome");
  return result;
}
