// Génère public/firebase-messaging-sw.js à partir des variables d'environnement.
// La config Firebase n'est pas secrète, mais un service worker ne peut pas lire
// import.meta.env — ce script l'injecte donc en dur avant le build/dev.
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ quiet: true });

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || "",
};

const content = `// Fichier généré automatiquement par scripts/generate-fcm-sw.js — ne pas éditer à la main.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(cfg, null, 2)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "AWC CRM", {
    body: body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });
});
`;

writeFileSync(new URL("../public/firebase-messaging-sw.js", import.meta.url), content);
console.log("firebase-messaging-sw.js généré.");
