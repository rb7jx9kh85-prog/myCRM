import { getOAuthClient } from "./_googleClient.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export default function handler(req, res) {
  const oauth2Client = getOAuthClient(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force le renvoi d'un refresh_token à chaque connexion
    scope: SCOPES,
  });
  res.redirect(url);
}
