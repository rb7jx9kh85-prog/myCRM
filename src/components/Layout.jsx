import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LINKS = [
  { to: "/", label: "Accueil", icon: "⌂", end: true },
  { to: "/prospects", label: "Prospects", icon: "◎" },
  { to: "/leads", label: "Gestion des leads", icon: "◈" },
  { to: "/recherche", label: "Recherche", icon: "⌕" },
  { to: "/cold-call", label: "Cold call", icon: "◉" },
  { to: "/planning", label: "Planning", icon: "□" },
  { to: "/suggestions", label: "Suggestions", icon: "◇" },
  { to: "/taches", label: "Tâches", icon: "✓" },
  { to: "/agent", label: "Agent IA", icon: "✦", featured: true },
  { to: "/reglages", label: "Réglages", icon: "⚙" },
];
const MOBILE_LINKS = new Set(["/", "/prospects", "/leads", "/taches"]);

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeLink = LINKS.find((link) => link.end ? location.pathname === link.to : location.pathname.startsWith(link.to));
  const moreActive = activeLink && !MOBILE_LINKS.has(activeLink.to);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  function renderLink(link, className = "") {
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={({ isActive }) => `${className}${isActive ? " active" : ""}${link.featured ? " featured" : ""}`.trim()}
      >
        <span className="nav-icon" aria-hidden="true">{link.icon}</span>
        <span>{link.label}</span>
      </NavLink>
    );
  }

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
          {LINKS.map((link) => renderLink(link))}
        </div>
        <button className="nav-logout" onClick={logout}>
          <span aria-hidden="true">↗</span>
          <span>Déconnexion</span>
        </button>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>

      {moreOpen && (
        <div className="mobile-more-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreOpen(false); }}>
          <div className="mobile-more-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-more-grid">
              {LINKS.filter((link) => !MOBILE_LINKS.has(link.to)).map((link) => renderLink(link, "mobile-more-link"))}
            </div>
            <button className="mobile-logout" onClick={logout}>Déconnexion</button>
          </div>
        </div>
      )}

      <nav className="mobile-dock" aria-label="Navigation mobile">
        {LINKS.filter((link) => MOBILE_LINKS.has(link.to)).map((link) => renderLink(link))}
        <button className={moreActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen((open) => !open)}>
          <span className="nav-icon" aria-hidden="true">•••</span>
          <span>Plus</span>
        </button>
      </nav>
    </div>
  );
}
