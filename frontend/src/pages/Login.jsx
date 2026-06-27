import { useState, useEffect } from "react";
import { login, getLoginBanner, setToken, setUserInfo } from "../api.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const BASE = import.meta.env.VITE_API_URL || "/api";

const FEATURES = [
  { icon: "📹", text: "Bulk video posting from Google Drive or TikTok" },
  { icon: "👥", text: "Multi-user SaaS — each user has isolated data" },
  { icon: "⏰", text: "Smart scheduling with live follower & video stats" },
  { icon: "🔒", text: "Your data stays private in your own cloud" },
];

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [banner, setBanner]     = useState({});
  const [tab, setTab]           = useState("google"); // "google" | "password"

  useEffect(() => {
    getLoginBanner().then(setBanner).catch(() => {});
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initGoogleButton();
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, [GOOGLE_CLIENT_ID]);

  const initGoogleButton = () => {
    if (!window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(
      document.getElementById("google-signin-btn"),
      { theme: "outline", size: "large", width: 320, text: "signin_with" }
    );
  };

  const handleGoogleCallback = async (response) => {
    setGoogleLoading(true); setError("");
    try {
      const res = await fetch(BASE + "/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setUserInfo({ username: data.username, role: data.role, user_id: data.user_id, picture: data.picture });
        onSuccess({ username: data.username, role: data.role, user_id: data.user_id });
      } else {
        setError(data.error || "Google লগইন ব্যর্থ হয়েছে");
      }
    } catch {
      setError("সার্ভারে সংযোগ হচ্ছে না।");
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await login(username.trim(), password);
      if (res.success) onSuccess({ username: res.username, role: res.role, user_id: res.user_id });
      else setError(res.error || "লগইন ব্যর্থ হয়েছে");
    } catch { setError("সার্ভারে সংযোগ হচ্ছে না।"); }
    setLoading(false);
  };

  const buildLink = (type, raw) => {
    const v = (raw || "").trim(); if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (type === "telegram")  return `https://t.me/${v.replace(/^@/, "")}`;
    if (type === "whatsapp")  return `https://wa.me/${v.replace(/\D/g, "")}`;
    if (type === "messenger") return `https://m.me/${v.replace(/^@/, "")}`;
    return v;
  };

  const contacts = [
    { type: "telegram",  icon: "📨", color: "#229ED9", link: buildLink("telegram", banner.contact_telegram) },
    { type: "whatsapp",  icon: "💬", color: "#25D366", link: buildLink("whatsapp", banner.contact_whatsapp) },
    { type: "messenger", icon: "✉️", color: "#0084FF", link: buildLink("messenger", banner.contact_messenger) },
  ].filter(c => c.link);

  return (
    <div className="login-screen"
      style={banner.banner_url ? { backgroundImage: `url(${banner.banner_url})` } : {}}>
      <div className="login-overlay" />

      {contacts.length > 0 && (
        <div className="login-contact-icons">
          {contacts.map(c => (
            <a key={c.type} href={c.link} target="_blank" rel="noopener noreferrer"
              className="contact-icon-btn" style={{ "--icon-color": c.color }}>
              {c.icon}
            </a>
          ))}
        </div>
      )}

      <div className="login-page-wrap">
        {/* Left hero */}
        <div className="login-hero">
          <div className="login-logo">
            <span className="logo-icon" style={{ fontSize: 32 }}>🤖</span>
            <span className="logo-text" style={{ fontSize: 20 }}>AutoPost <b>Pro</b></span>
          </div>
          <h1 className="login-headline">Automate your Facebook video posting — on autopilot.</h1>
          <p className="login-hero-sub">
            Connect unlimited Pages, pull videos from Google Drive, and schedule posts that run 24/7 on the server — even when your PC is off.
          </p>
          <ul className="login-features">
            {FEATURES.map(f => (
              <li key={f.text}><span className="feat-icon">{f.icon}</span>{f.text}</li>
            ))}
          </ul>
          <div className="login-policy-links">
            <a href="#">Privacy Policy</a>{" · "}<a href="#">Terms of Service</a>
          </div>
        </div>

        {/* Right card */}
        <div className="login-right">
          <div className="login-card">
            <p className="login-welcome">Welcome back</p>
            <p className="login-subtitle">Sign in to your dashboard.</p>

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setTab("google")}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === "google" ? "#4285F4" : "#2a2a3a",
                  color: "#fff", fontWeight: 600, fontSize: 13,
                }}>
                🔵 Google
              </button>
              <button
                onClick={() => setTab("password")}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  background: tab === "password" ? "#7c3aed" : "#2a2a3a",
                  color: "#fff", fontWeight: 600, fontSize: 13,
                }}>
                🔑 Password
              </button>
            </div>

            {/* Google Sign-in */}
            {tab === "google" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {GOOGLE_CLIENT_ID ? (
                  <>
                    <div id="google-signin-btn" style={{ minHeight: 44 }} />
                    {googleLoading && <p style={{ color: "#aaa", fontSize: 13 }}>⏳ Signing in with Google...</p>}
                  </>
                ) : (
                  <div style={{
                    background: "#1e1e2e", border: "1px dashed #555", borderRadius: 10,
                    padding: "16px 20px", textAlign: "center", fontSize: 13, color: "#aaa"
                  }}>
                    ⚙️ Google Sign-in এখনো configure হয়নি।<br />
                    Admin → Settings থেকে <b>GOOGLE_CLIENT_ID</b> সেট করুন।
                  </div>
                )}
              </div>
            )}

            {/* Password login */}
            {tab === "password" && (
              <form onSubmit={handleSubmit}>
                <label>Username</label>
                <input autoFocus placeholder="admin" value={username}
                  onChange={e => setUsername(e.target.value)} />
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} />
                <button className="btn-primary full-width" style={{ marginTop: 18 }}
                  type="submit" disabled={loading}>
                  {loading ? "⏳ Signing in..." : "Login →"}
                </button>
              </form>
            )}

            {error && <p className="login-error" style={{ marginTop: 12 }}>⚠️ {error}</p>}
          </div>

          {banner.contract_text && (
            <p className="login-contract-text"
              style={{ position: "static", transform: "none", marginTop: 16, maxWidth: 380 }}>
              {banner.contract_text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
