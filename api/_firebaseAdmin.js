// Init Firebase Admin partagée par les fonctions serverless (bypass les
// règles Firestore côté client — usage serveur uniquement).
// FIREBASE_SERVICE_ACCOUNT_KEY = JSON complet de la clé de compte de service,
// encodé en une seule ligne, à définir dans Vercel > Environment Variables.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT manque dans Vercel.");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY n'est pas un JSON valide (vérifie qu'elle a été collée en entier, sans guillemets autour).");
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
