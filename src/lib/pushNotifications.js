import { getToken } from "firebase/messaging";
import { getMessagingIfSupported } from "../firebase";
import { saveFcmToken } from "./settings";

// true seulement si l'app tourne installée (écran d'accueil) — sur iOS,
// Safari seul ne supporte JAMAIS les notifications push, quel que soit le
// statut de permission (contrainte Apple, iOS 16.4+ minimum).
export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Active les notifications push sur cet appareil : demande la permission,
// récupère le token FCM et l'enregistre côté serveur (settings/fcmTokens).
// Retourne { ok: true } ou { ok: false, reason } en français, prêt à afficher.
export async function enablePushNotifications() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Permission refusée." };
    }
    const messaging = await getMessagingIfSupported();
    if (!messaging) {
      return { ok: false, reason: "Notifications push non supportées sur cet appareil/navigateur." };
    }
    const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
    await saveFcmToken(token);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Erreur lors de l'activation des notifications." };
  }
}
