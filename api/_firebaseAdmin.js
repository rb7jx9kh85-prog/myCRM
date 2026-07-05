// Init Firebase Admin partagée par les fonctions serverless (bypass les
// règles Firestore côté client — usage serveur uniquement).
// FIREBASE_SERVICE_ACCOUNT_KEY = JSON complet de la clé de compte de service,
// encodé en une seule ligne, à définir dans Vercel > Environment Variables.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY manquante dans les variables d'environnement Vercel.");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY n'est pas un JSON valide (vérifie qu'elle a été collée en entier, sans guillemets autour).");
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
