import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LINKS = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/prospects", label: "Prospects" },
  { to: "/recherche", label: "Recherche" },
  { to: "/cold-call", label: "Cold call" },
  { to: "/planning", label: "Planning" },
  { to: "/suggestions", label: "Suggestions" },
  { to: "/taches", label: "Tâches" },
  { to: "/reglages", label: "Réglages" },
];

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {l.label}
          </NavLink>
        ))}
        <button onClick={logout} style={{ marginTop: 16, width: "100%" }}>
          Déconnexion
        </button>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
