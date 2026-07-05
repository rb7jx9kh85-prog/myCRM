# AWC CRM

CRM interne d'Alpinia Web Craft — prospection, qualification ICP et suivi de pipeline.
React + Vite, Firebase (Auth + Firestore + Cloud Messaging), API routes serverless
sur Vercel pour tout ce qui touche à des clés sensibles (Geoapify, Google Sheets, FCM).

## Stack

- Frontend : React + Vite, React Router
- Auth + données : Firebase Auth (email/mot de passe, compte unique) + Firestore
- Backend : Vercel Serverless Functions (`/api`) — aucune Firebase Cloud Function
- Intégrations : Geoapify Places (recherche de prospects), Google Sheets (sync
  bidirectionnelle manuelle), Firebase Cloud Messaging (notifications push)

## Variables d'environnement à définir dans Vercel

**Vercel → ton projet → Settings → Environment Variables.** Ne mets jamais ces
valeurs dans le code ou dans un commit — la config Firebase ci-dessous n'est
pas secrète en soi, mais les clés Geoapify/Google/Firebase Admin le sont.

| Variable | Où la trouver | Secrète ? |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Paramètres du projet → Général → App web | Non |
| `VITE_FIREBASE_AUTH_DOMAIN` | idem | Non |
| `VITE_FIREBASE_PROJECT_ID` | idem | Non |
| `VITE_FIREBASE_STORAGE_BUCKET` | idem | Non |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | idem | Non |
| `VITE_FIREBASE_APP_ID` | idem | Non |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Console → Cloud Messaging → Certificats Web Push → générer une paire de clés | Non (clé publique VAPID) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Console → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée → colle le JSON complet sur une seule ligne | **Oui** |
| `GEOAPIFY_API_KEY` | Ta clé Geoapify existante | **Oui** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Identifiants → Client OAuth 2.0 (type "Application Web"), redirect URI = `https://<ton-domaine-vercel>/api/sheets/callback` | **Oui** (le secret) |
| `CRON_SECRET` | Choisis une chaîne aléatoire toi-même | **Oui** |

Après avoir tout ajouté : redéploie le projet pour que les variables soient prises en compte.

## Compte Firebase Auth

Un seul compte est autorisé (usage solo). Crée-le dans Firebase Console →
Authentication → méthode Email/mot de passe → Ajouter un utilisateur. Édite
ensuite `firestore.rules` pour remplacer `REMPLACE_PAR_TON_EMAIL@example.com`
par ton adresse exacte, puis déploie les règles (Firebase Console → Firestore
→ Règles → coller le contenu du fichier → Publier).

## Google Sheets — première connexion

1. Crée un projet Google Cloud (console.cloud.google.com), active l'API
   "Google Sheets API".
2. Écran de consentement OAuth : type "Externe", ajoute ton propre email
   comme "utilisateur de test" (l'app resterait en mode test, ce qui suffit
   pour un usage strictement personnel).
3. Crée un identifiant OAuth "Application Web" avec comme URI de
   redirection `https://<ton-domaine-vercel>/api/sheets/callback`.
4. Une fois les variables d'env en place, va dans Réglages → "Connecter mon
   compte Google". Un nouveau Google Sheet "AWC CRM — Prospects" est créé
   automatiquement au premier lien.

La synchronisation est **manuelle** (bouton "Synchroniser"), jamais en temps
réel, pour ne pas consommer de quota inutilement. En cas de modification des
deux côtés depuis la dernière synchro, l'app affiche les deux versions et te
demande laquelle garder — rien n'est jamais écrasé automatiquement.

Deux colonnes techniques (`ID` en colonne A) sont ajoutées au Sheet en plus
des colonnes demandées : elles servent à faire correspondre les lignes entre
Sheets et Firestore, ne les supprime pas.

## Notifications push (Firebase Cloud Messaging)

**Contrainte importante sur iPhone** : les notifications push web ne
fonctionnent sur iOS que si l'app est installée via "Partager → Sur l'écran
d'accueil" (PWA), et uniquement à partir d'**iOS 16.4**. Dans Safari seul
(onglet navigateur classique), les push ne fonctionneront jamais sur iPhone —
ce n'est pas un bug de l'app, c'est une limitation d'Apple. Sur Android,
Chrome installé ou non fonctionne nativement.

Le plan Vercel Hobby ne permet qu'un cron par jour : les rappels sont donc
regroupés en **un digest quotidien** (6h du matin) plutôt que des push en
temps réel à la minute près. Passer à Vercel Pro permettrait des crons plus
fréquents si besoin plus tard.

### Ajouter un nouveau critère de déclenchement

Tout est centralisé dans `src/config/notificationTriggers.js` :
1. Ajoute une entrée `{ id, label, defaultEnabled, params }`.
2. Implémente la logique de vérification dans `api/cron/daily-digest.js`
   (lecture Firestore → ajoute une ligne à `lines` si la condition est
   remplie).
3. Rien à changer côté UI : l'écran Réglages génère le toggle et les champs
   de paramètres automatiquement à partir de cette liste.

## Grille de scoring ICP et recommandations

- `src/config/icpScoring.js` : points par critère, red flags, règle
  d'exclusion automatique.
- `src/config/recommendationEngine.js` : règles de recommandation de
  prestation (Starter / Junior / PME Élite / Sur devis).

Ces deux fichiers sont volontairement séparés de la logique de calcul
(`src/lib/scoring.js`) pour rester modifiables sans toucher au reste de l'app.

## Développement local

```bash
npm install
cp .env.example .env   # renseigne les valeurs Firebase (non secrètes)
npm run dev
```

Pour tester les fonctions `/api` localement il faut la Vercel CLI
(`vercel dev`) avec un `.env` contenant aussi les variables secrètes.
