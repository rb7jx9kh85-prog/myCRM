import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const leadsCol = collection(db, "leads");

export function subscribeLeads(callback, onError) {
  const leadsQuery = query(leadsCol, orderBy("updatedAt", "desc"));
  return onSnapshot(leadsQuery, (snapshot) => {
    callback(snapshot.docs.map((lead) => ({ id: lead.id, ...lead.data() })));
  }, onError);
}

export function createLead(input) {
  return addDoc(leadsCol, {
    ...input,
    status: input.status || "nouveau",
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateLead(id, input) {
  return updateDoc(doc(db, "leads", id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

// Un lead n'est jamais supprimé : il reste disponible dans les archives.
export function archiveLead(id) {
  return updateDoc(doc(db, "leads", id), {
    archived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function restoreLead(id) {
  return updateDoc(doc(db, "leads", id), {
    archived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
}
