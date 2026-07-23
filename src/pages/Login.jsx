import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

// Messages explicites par code d'erreur Firebase Auth — évite de masquer la
// vraie cause (ex: provider Email/Mot de passe désactivé côté Firebase, ou
// config VITE_FIREBASE_* absente/erronée) derrière un message générique.
const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet email — crée-le dans Firebase Console → Authentication.",
  "auth/invalid-email": "Adresse email invalide.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/operation-not-allowed": "Connexion Email/Mot de passe désactivée dans Firebase Console → Authentication → Sign-in method.",
  "auth/network-request-failed": "Erreur réseau — vérifie ta connexion et réessaie.",
  "auth/too-many-requests": "Trop de tentatives, réessaie dans quelques minutes.",
  "auth/invalid-api-key": "Clé Firebase invalide — vérifie VITE_FIREBASE_API_KEY dans Vercel.",
  "auth/configuration-not-found": "Provider Email/Mot de passe non configuré dans Firebase Console → Authentication → Sign-in method.",
};

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      window.location.replace("/");
    } catch (err) {
      setError(AUTH_ERROR_MESSAGES[err.code] || `Erreur de connexion : ${err.code || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-orb login-orb-orange" />
      <div className="login-orb login-orb-blue" />
      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-brand">
          <span className="brand-mark">A</span>
          <span>Alpinia CRM<span className="brand-dot">.</span></span>
        </div>
        <div className="eyebrow">Espace commercial</div>
        <h1>Bon retour.</h1>
        <p className="login-intro">Prospects, cold calls et prochaines actions — au même endroit.</p>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="login-password">Mot de passe</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="form-error">{error}</p>}
        <button className="primary login-submit" type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Me connecter"}
          <span aria-hidden="true">→</span>
        </button>
        <p className="login-secure">Connexion sécurisée · Firebase</p>
      </form>
    </div>
  );
}
