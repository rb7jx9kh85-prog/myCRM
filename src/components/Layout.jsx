import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LINKS = [
  { to: "/", label: "Accueil", icon: "⌂", end: true },
  { to: "/prospects", label: "Prospects", icon: "◎" },
  { to: "/recherche", label: "Recherche", icon: "⌕" },
  { to: "/cold-call", label: "Cold call", icon: "◉" },
  { to: "/planning", label: "Planning", icon: "□" },
  { to: "/suggestions", label: "Suggestions", icon: "◇" },
  { to: "/taches", label: "Tâches", icon: "✓" },
  { to: "/agent", label: "Agent IA", icon: "✦", featured: true },
  { to: "/reglages", label: "Réglages", icon: "⚙" },
];

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const activeLink = LINKS.find((link) => link.end ? location.pathname === link.to : location.pathname.startsWith(link.to));

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="brand-lockup">
          <span className="brand-mark">A</span>
          <span>Alpinia CRM<span className="brand-dot">.</span></span>
        </div>
        <span className="mobile-page-title">{activeLink?.label || "CRM"}</span>
      </header>
      <nav className="app-nav">
        <div className="nav-brand brand-lockup">
          <span className="brand-mark">A</span>
          <span>Alpinia CRM<span className="brand-dot">.</span></span>
        </div>
        <div className="nav-links">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `${isActive ? "active" : ""}${l.featured ? " featured" : ""}`}
            >
              <span className="nav-icon" aria-hidden="true">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </div>
        <button className="nav-logout" onClick={logout}>
          <span aria-hidden="true">↗</span>
          <span>Déconnexion</span>
        </button>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
