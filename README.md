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
| `OPENAI_API_KEY` | Ta clé OpenAI existante | **Oui** |
| `OPENAI_MODEL` | Optionnel, défaut `gpt-5.6-luna` (tier le moins cher d'OpenAI) — utilisé pour tous les appels IA (scoring ICP, jugement des sites web, angles d'appel) | Non |
| `GOOGLE_PLACES_API_KEY` | Optionnel — active le filtre strict "fermé définitivement sur Google Maps" à la recherche (coût séparé, facturé par Google). Sans clé, ce filtre est simplement ignoré | Non |

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

## Enrichissement IA (OpenAI)

Sur l'écran Recherche, après une recherche Geoapify, le bouton "Enrichir
avec l'IA" envoie les résultats à `api/enrich/analyze.js`, qui appelle
OpenAI avec un system prompt construit à partir de `src/config/icpProfile.js`
— ce fichier contient l'intégralité de ton document ICP (client idéal,
signaux positifs, red flags, pain points, offres, budgets, cantons
prioritaires). Modifie ce fichier si tes critères évoluent, aucune autre
partie du code à toucher.

L'IA ne voit que les données factuelles disponibles (nom, type, adresse,
téléphone, présence d'un site) — elle ne peut pas juger les avis Google, la
qualité des photos ou l'activité Instagram, et renvoie explicitement "à
vérifier manuellement" sur ces points plutôt que d'inventer une réponse.
Chaque résultat reçoit un badge (Recommandé / À vérifier / À exclure) et un
raisonnement consultable au survol ; à l'import, les red flags et besoins
détectés pré-remplissent la fiche prospect (tout reste modifiable).

## Filtre qualité (recherche) et vérification des sites web

À la recherche (`Recherche` → Geoapify), `api/enrich/analyze.js` récupère un
extrait borné (taille + timeout, pas de crawl) du site de chaque candidat
via `api/enrich/_websiteSignals.js` (titre, extrait de texte **réellement
visible** sur la page, longueur du texte, balise viewport, année de
copyright, détection domaine parqué / page par défaut), puis un **unique**
appel IA (`gpt-5.6-luna` par défaut) juge chaque site — vide/cassé/nul/daté
(2010-2020) compte comme signal positif (le prospect a besoin d'un site),
un site déjà excellent déclenche le red flag `greatWebsite` (exclusion). Un
site injoignable est traité directement sans appel IA. Coût cible : moins de
0,02 $ pour 20 prospects.

Si `GOOGLE_PLACES_API_KEY` est définie, les établissements notés "fermé
définitivement" sur Google Maps sont exclus automatiquement, sans même
passer par l'IA (Geoapify/OSM n'a pas cette info nativement — c'est un appel
Google Places séparé, facturé par Google en plus du budget IA OpenAI). Sans
cette clé, ce filtre précis est simplement ignoré.

Sur l'écran Prospects, le bouton "Vérifier les sites web" applique la même
logique de jugement (via `api/enrich/check-website.js`, réutilise
`_websiteSignals.js`) pour re-vérifier en lot les prospects déjà importés.
Le résultat pré-remplit le critère "Site très ancien" du scoring ICP et
affiche un badge (Site ancien / Site moderne / Injoignable) dans la liste.

## Suggestions de créneaux et d'accroches d'appel

Écran "Suggestions" : propose des sessions de cold call groupées par type
d'établissement, sur les créneaux jugés les plus favorables (règles statiques,
gratuites, dans `src/config/callingWindows.js` — à ajuster librement selon
ton expérience terrain). Seuls les prospects "à contacter" pas encore
planifiés sont proposés (`src/lib/suggestSessions.js`, pur calcul, n'écrit
rien en base).

Pour chaque suggestion, le bouton "Accroches IA" appelle `api/enrich/call-angles.js`
— un seul appel IA pour tout le lot de prospects de la session, réutilisant
le profil ICP (`src/config/icpProfile.js`) — et génère une phrase d'accroche
+ un angle de pain point par prospect. Ces accroches sont ensuite affichées
directement dans la vue "Cold call" pendant l'appel. Rien n'est créé tant que
tu ne cliques pas "Créer cette session".

## Enrichissement des numéros de téléphone (Geoapify, sans coût IA)

Sur l'écran Recherche, les fiches sans téléphone sont automatiquement
complétées après chaque recherche via l'API Geoapify Place Details
(`api/geoapify/place-details.js`) — même clé `GEOAPIFY_API_KEY`, pas
d'appel IA. À l'import, l'identifiant Geoapify (`geoapifyPlaceId`) est
conservé sur le prospect ; le bouton "Enrichir les numéros de téléphone" sur
l'écran Prospects permet de relancer la recherche plus tard pour les
prospects encore sans numéro (ne fonctionne que pour les prospects importés
après l'ajout de cette fonctionnalité, faute d'identifiant Geoapify stocké
avant).

## Gestion des tâches

Écran "Tâches" : liste de tâches libres (titre, échéance optionnelle, lien
optionnel vers un prospect), indépendante des sessions de cold call —
groupées par échéance (en retard / aujourd'hui / à venir / sans échéance).
Un résumé (en retard, dues aujourd'hui, total) apparaît sur le tableau de
bord. Chaque fiche prospect affiche aussi ses tâches liées avec ajout rapide
(`src/components/ProspectTasks.jsx`). Collection Firestore `tasks`, couverte
par la même règle de sécurité que le reste (`firestore.rules`).

## Développement local

```bash
npm install
cp .env.example .env   # renseigne les valeurs Firebase (non secrètes)
npm run dev
```

Pour tester les fonctions `/api` localement il faut la Vercel CLI
(`vercel dev`) avec un `.env` contenant aussi les variables secrètes.
