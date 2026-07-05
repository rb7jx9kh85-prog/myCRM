import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const sessionsCol = collection(db, "sessions");

// session = { date: "2026-07-06", startTime: "14:00", durationMinutes: 60,
//             prospectIds: [...], status: "planned" | "done" }
export function subscribeSessions(callback) {
  const q = query(sessionsCol, orderBy("date", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createSession(input) {
  return addDoc(sessionsCol, { status: "planned", ...input });
}

export async function updateSession(id, input) {
  return updateDoc(doc(db, "sessions", id), input);
}

export async function deleteSession(id) {
  return deleteDoc(doc(db, "sessions", id));
}
