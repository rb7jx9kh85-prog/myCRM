// Init Firebase Admin partagée par les fonctions serverless (bypass les
// règles Firestore côté client — usage serveur uniquement).
// FIREBASE_SERVICE_ACCOUNT_KEY = JSON complet de la clé de compte de service,
// encodé en une seule ligne, à définir dans Vercel > Environment Variables.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
