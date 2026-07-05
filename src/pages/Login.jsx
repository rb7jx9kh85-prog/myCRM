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
    } catch (err) {
      setError(AUTH_ERROR_MESSAGES[err.code] || `Erreur de connexion : ${err.code || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 320 }}>
        <h2 style={{ marginTop: 0 }}>AWC CRM</h2>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Mot de passe</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button className="primary" type="submit" disabled={loading} style={{ marginTop: 16, width: "100%" }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
