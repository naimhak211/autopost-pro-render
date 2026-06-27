import { useEffect, useState } from "react";
import { getCredits } from "../api.js";

export default function Sidebar({ page, setPage, open, setOpen, onLogout, theme, setTheme, user }) {
  const [credits, setCredits] = useState(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    getCredits().then(d => setCredits(d.credits)).catch(() => {});
  }, [page]);

  const NAV = [
    { section: "PLATFORM" },
    { id: "dashboard",     icon: "📊", label: "Dashboard" },
    { section: "FACEBOOK" },
    { id: "pagesaccounts", icon: "👥", label: "Pages & Accounts" },
    { id: "workflows",     icon: "▶",  label: "Automations" },
    { section: "TOOLS" },
    { id: "schedule",      icon: "📅", label: "Schedule" },
    { id: "scraper",       icon: "📥", label: "Scraper" },
    { id: "analytics",     icon: "📈", label: "Analytics" },
    { id: "ai",            icon: "🤖", label: "AI Caption" },
    { id: "logs",          icon: "📋", label: "Logs" },
    { section: "GENERAL" },
    ...(isAdmin ? [
      { id: "adminusers",  icon: "👥", label: "Users" },
      { id: "settings",    icon: "⚙️", label: "Settings" },
    ] : []),
    { id: "profile",       icon: "👤", label: "My Profile" },
    { id: "billing",       icon: "💳", label: "Billing" },
    { id: "contact",       icon: "✉️", label: "Contact Us" },
    { id: "privacy",       icon: "📄", label: "Privacy" },
    { id: "terms",         icon: "📋", label: "Terms" },
  ];

  return (
    <div className={`sidebar ${open ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">🤖</span>
          {open && <span className="logo-text">AutoPost <b>Pro</b></span>}
        </div>
        <button className="toggle-btn" onClick={() => setOpen(o => !o)}>
          {open ? "◀" : "▶"}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return open
              ? <p key={i} className="nav-section-label">{item.section}</p>
              : <div key={i} className="nav-section-divider" />;
          }
          return (
            <button key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              {open && <span className="nav-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {/* User info */}
        {open && user?.username && (
          <div className="user-pill" onClick={() => setPage("profile")}>
            <span className="user-avatar">{user.role === "admin" ? "👑" : "👤"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</p>
              <p style={{ fontSize: 10, color: "var(--muted)" }}>{user.role}</p>
            </div>
            {credits !== null && (
              <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>💎{credits}</span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button className="nav-item" style={{ flex: 1 }}
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            <span className="nav-icon">{theme === "dark" ? "☀" : "🌙"}</span>
            {open && <span className="nav-label">{theme === "dark" ? "Light" : "Dark"}</span>}
          </button>
          <button className="nav-item" style={{ flex: 1 }} onClick={onLogout}>
            <span className="nav-icon">⏻</span>
            {open && <span className="nav-label">Logout</span>}
          </button>
        </div>
        {open && <p className="version">v4.0.0 SaaS</p>}
      </div>
    </div>
  );
}
