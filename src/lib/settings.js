import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { NOTIFICATION_TRIGGERS } from "../config/notificationTriggers";

const settingsRef = doc(db, "settings", "notifications");

export function defaultNotificationSettings() {
  const defaults = {};
  for (const t of NOTIFICATION_TRIGGERS) {
    defaults[t.id] = { enabled: t.defaultEnabled, ...t.params };
  }
  return defaults;
}

export async function getNotificationSettings() {
  const snap = await getDoc(settingsRef);
  return snap.exists() ? snap.data() : defaultNotificationSettings();
}

export function subscribeNotificationSettings(callback) {
  return onSnapshot(settingsRef, (snap) => {
    callback(snap.exists() ? snap.data() : defaultNotificationSettings());
  });
}

export async function saveNotificationSettings(settings) {
  return setDoc(settingsRef, settings, { merge: true });
}

export async function saveFcmToken(token) {
  return setDoc(doc(db, "settings", "fcmTokens"), {
    [token]: true,
  }, { merge: true });
}
