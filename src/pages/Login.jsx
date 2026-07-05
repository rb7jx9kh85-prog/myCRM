import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

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
    } catch {
      setError("Identifiants incorrects.");
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
