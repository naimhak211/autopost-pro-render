import { useState, useEffect } from "react";
import Dashboard     from "./pages/Dashboard";
import PagesAccounts from "./pages/PagesAccounts";
import Workflows     from "./pages/Workflows";
import Schedule      from "./pages/Schedule";
import Analytics     from "./pages/Analytics";
import AICaption     from "./pages/AICaption";
import Scraper       from "./pages/Scraper";
import Logs          from "./pages/Logs";
import Settings      from "./pages/Settings";
import Billing       from "./pages/Billing";
import Contact       from "./pages/Contact";
import Privacy       from "./pages/Privacy";
import Terms         from "./pages/Terms";
import AdminUsers    from "./pages/AdminUsers";
import UserProfile   from "./pages/UserProfile";
import Login         from "./pages/Login";
import Sidebar       from "./components/Sidebar";
import NotificationBell from "./components/NotificationBell";
import { verifyToken, logout as apiLogout, getUserInfo } from "./api.js";
import "./App.css";

export default function App() {
  const [page, setPage]               = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed]           = useState(false);
  const [user, setUser]               = useState({});
  const [theme, setTheme]             = useState(() => localStorage.getItem("ap_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ap_theme", theme);
  }, [theme]);

  // Handle FB OAuth redirect
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("fb_connect") === "success") {
      const n = p.get("pages");
      alert(`✅ Facebook Login সফল!${n ? ` ${n}টা পেজ import হয়েছে।` : ""}`);
      window.history.replaceState({}, "", "/");
      setPage("pagesaccounts");
    } else if (p.get("fb_connect") === "failed") {
      alert("❌ Facebook Login ব্যর্থ। আবার চেষ্টা করুন।");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    verifyToken()
      .then(data => {
        setAuthed(true);
        setUser({ username: data.username, role: data.role, user_id: data.user_id });
      })
      .catch(() => setAuthed(false))
      .finally(() => setAuthChecked(true));

    const onUnauth = () => { setAuthed(false); setUser({}); };
    window.addEventListener("autopost-unauthorized", onUnauth);
    return () => window.removeEventListener("autopost-unauthorized", onUnauth);
  }, []);

  const handleLogout = () => { apiLogout(); setAuthed(false); setUser({}); };
  const handleLoginSuccess = (userData) => {
    setAuthed(true);
    setUser(userData || getUserInfo());
  };

  if (!authChecked) return <div className="auth-loading"><div className="pulse-ring" /></div>;
  if (!authed)      return <Login onSuccess={handleLoginSuccess} />;

  const isAdmin = user.role === "admin";

  const pages = {
    dashboard:    <Dashboard />,
    pagesaccounts:<PagesAccounts />,
    workflows:    <Workflows />,
    schedule:     <Schedule />,
    analytics:    <Analytics />,
    ai:           <AICaption />,
    scraper:      <Scraper />,
    logs:         <Logs />,
    settings:     isAdmin ? <Settings /> : <div className="page"><div className="empty-state"><p>⛔ Admin access প্রয়োজন</p></div></div>,
    billing:      <Billing />,
    contact:      <Contact />,
    privacy:      <Privacy />,
    terms:        <Terms />,
    adminusers:   isAdmin ? <AdminUsers /> : <div className="page"><div className="empty-state"><p>⛔ Admin access প্রয়োজন</p></div></div>,
    profile:      <UserProfile />,
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page} setPage={setPage}
        open={sidebarOpen} setOpen={setSidebarOpen}
        onLogout={handleLogout}
        theme={theme} setTheme={setTheme}
        user={user}
      />
      <main className={`main-content ${sidebarOpen ? "shifted" : ""}`}>
        <div style={{position:"fixed",top:12,right:16,zIndex:999}}>
          <NotificationBell />
        </div>
        {pages[page] || <Dashboard />}
      </main>
    </div>
  );
}
