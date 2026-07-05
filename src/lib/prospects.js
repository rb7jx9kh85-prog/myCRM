import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { computeScore } from "./scoring";
import { recommend } from "../config/recommendationEngine";

const prospectsCol = collection(db, "prospects");

// Recalcule score + red flags + recommandation à partir des critères saisis,
// et renvoie l'objet prospect complet prêt à être écrit dans Firestore.
export function buildProspectPayload(input) {
  const { total, redFlags, autoExcluded } = computeScore(input.criteria || {});
  const { offer, reason } = recommend(input, total, autoExcluded);

  return {
    ...input,
    scoreTotal: total,
    redFlags,
    autoExcluded,
    recommendation: { offerId: offer?.id ?? null, offerLabel: offer?.label ?? null, reason },
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
  return addDoc(prospectsCol, {
    ...payload,
    pipelineStatus: input.pipelineStatus || "a_contacter",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProspect(id, input) {
  const payload = buildProspectPayload(input);
  return updateDoc(doc(db, "prospects", id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProspect(id) {
  return deleteDoc(doc(db, "prospects", id));
}

export async function logCallOutcome(id, nextStatus, callbackDate) {
  return updateDoc(doc(db, "prospects", id), {
    pipelineStatus: nextStatus,
    lastContactDate: serverTimestamp(),
    ...(callbackDate ? { nextCallDate: callbackDate } : {}),
    updatedAt: serverTimestamp(),
  });
}
