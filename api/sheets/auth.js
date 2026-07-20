import { getOAuthClient } from "./_googleClient.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export default function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquant côté serveur.");
  }
  try {
    const oauth2Client = getOAuthClient(req);
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // force le renvoi d'un refresh_token à chaque connexion
      scope: SCOPES,
    });
    res.redirect(url);
  } catch (err) {
    console.error("sheets/auth error:", err);
    res.status(500).send(`Erreur : ${err.message || "erreur inconnue"}`);
  }
}
