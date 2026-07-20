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

const tasksCol = collection(db, "tasks");

// task = { title, dueDate: "YYYY-MM-DD"|null, time: "HH:MM"|null, done: bool,
//          reminderMinutesBefore: number|null, recurrence: "none"|"daily"|"weekly"|"monthly",
//          prospectId: string|null, prospectName: string|null }
export function subscribeTasks(callback) {
  const q = query(tasksCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createTask(input) {
  return addDoc(tasksCol, {
    title: input.title,
    dueDate: input.dueDate || null,
    time: input.time || null,
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    recurrence: input.recurrence || "none",
    done: false,
    prospectId: input.prospectId || null,
    prospectName: input.prospectName || null,
    createdAt: serverTimestamp(),
  });
}

export async function toggleTaskDone(id, done) {
  return updateDoc(doc(db, "tasks", id), { done });
}

export async function updateTask(id, input) {
  return updateDoc(doc(db, "tasks", id), input);
}

export async function deleteTask(id) {
  return deleteDoc(doc(db, "tasks", id));
}
