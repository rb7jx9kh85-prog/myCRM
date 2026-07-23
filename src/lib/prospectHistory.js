import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export async function recordProspectVersion(prospectId, snapshot, action, actor = "user") {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...safeSnapshot } = snapshot || {};
  return addDoc(collection(db, "prospects", prospectId, "versions"), {
    action,
    actor,
    snapshot: safeSnapshot,
    createdAt: serverTimestamp(),
  });
}

export function subscribeProspectVersions(prospectId, callback) {
  const versionsQuery = query(
    collection(db, "prospects", prospectId, "versions"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(versionsQuery, (snap) => {
    callback(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
  });
}
