import { useState, useEffect, useRef } from "react";

const BASE = import.meta.env.VITE_API_URL || "/api";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const setToken = (t) => { localStorage.setItem("token", t); sessionStorage.setItem("token", t); };
const setUserInfo = (u) => { localStorage.setItem("userInfo", JSON.stringify(u)); };

const FEATURES = [
  { icon: "🤖", title: "Auto Posting", desc: "Schedule & post videos 24/7 — even when your phone is off" },
  { icon: "📁", title: "Google Drive", desc: "Pull videos directly from your Drive folders" },
  { icon: "📊", title: "Analytics", desc: "Track followers, likes, comments & video performance" },
  { icon: "👥", title: "Multi-User", desc: "Each user manages their own Pages and workflows" },
];

export default function Login({ onSuccess }) {
  const [tab, setTab]         = useState("login"); // login | register | google
  const [form, setForm]       = useState({ username:"", email:"", password:"", confirm:"" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const googleBtnRef = useRef(null);

  /* ── Google GIS ── */
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogle,
        auto_select: false,
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline", size: "large", width: 300, text: "signin_with",
        });
      }
    };
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, [GOOGLE_CLIENT_ID, tab]);

  const handleGoogle = async (res) => {
    setGLoading(true); setError("");
    try {
      const r = await fetch(BASE + "/auth/google", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: res.credential }),
      });
      const d = await r.json();
      if (d.success) { setToken(d.token); setUserInfo(d); onSuccess(d); }
      else setError(d.error || "Google login ব্যর্থ হয়েছে");
    } catch { setError("সার্ভারে সংযোগ হচ্ছে না"); }
    setGLoading(false);
  };

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(BASE + "/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const d = await r.json();
      if (d.success) { setToken(d.token); setUserInfo(d); onSuccess(d); }
      else setError(d.error || "Login ব্যর্থ হয়েছে");
    } catch { setError("সার্ভারে সংযোগ হচ্ছে না"); }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) return;
    if (form.password !== form.confirm) { setError("Password মিলছে না"); return; }
    if (form.password.length < 6) { setError("Password কমপক্ষে 6 অক্ষর হতে হবে"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(BASE + "/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
      });
      const d = await r.json();
      if (d.success) { setToken(d.token); setUserInfo(d); onSuccess(d); }
      else setError(d.error || "Registration ব্যর্থ হয়েছে");
    } catch { setError("সার্ভারে সংযোগ হচ্ছে না"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", background:"#0D0E14", fontFamily:"'Inter','Noto Sans Bengali',sans-serif" }}>
      
      {/* ── Left hero (hidden on small screens) ── */}
      <div style={{
        flex: 1, display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"60px 48px", background:"linear-gradient(135deg,#13141C 0%,#0D0E14 100%)",
        borderRight:"1px solid #2A2B38",
        "@media(max-width:768px)": { display:"none" }
      }} className="login-hero-panel">
        <div style={{ maxWidth:480 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:40 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#6C63FF,#00C9A7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🤖</div>
            <span style={{ fontSize:20, fontWeight:700, color:"#E8E9F0" }}>AutoPost <span style={{color:"#6C63FF"}}>Pro</span></span>
          </div>

          <h1 style={{ fontSize:36, fontWeight:800, color:"#E8E9F0", lineHeight:1.2, marginBottom:16 }}>
            Facebook automation<br/>
            <span style={{ color:"#6C63FF" }}>on autopilot.</span>
          </h1>
          <p style={{ fontSize:15, color:"#6B6E85", lineHeight:1.7, marginBottom:40 }}>
            Connect unlimited Pages, pull videos from Google Drive, and post 24/7 — even when your phone is off.
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"#1A1B26", border:"1px solid #2A2B38", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{f.icon}</div>
                <div>
                  <p style={{ fontWeight:600, color:"#E8E9F0", fontSize:14, marginBottom:2 }}>{f.title}</p>
                  <p style={{ color:"#6B6E85", fontSize:13 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right auth panel ── */}
      <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column", justifyContent:"center", padding:"40px 32px" }}>
        
        {/* Mobile logo */}
        <div style={{ display:"none", alignItems:"center", gap:10, marginBottom:32 }} className="mobile-logo">
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6C63FF,#00C9A7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
          <span style={{ fontSize:18, fontWeight:700, color:"#E8E9F0" }}>AutoPost <span style={{color:"#6C63FF"}}>Pro</span></span>
        </div>

        <div style={{ background:"#13141C", border:"1px solid #2A2B38", borderRadius:20, padding:"32px 28px" }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:"#E8E9F0", marginBottom:4 }}>
            {tab === "register" ? "Account বানান" : "স্বাগতম"}
          </h2>
          <p style={{ color:"#6B6E85", fontSize:13, marginBottom:24 }}>
            {tab === "register" ? "নতুন account তৈরি করুন" : "আপনার dashboard-এ login করুন"}
          </p>

          {/* Tab switcher */}
          <div style={{ display:"flex", background:"#0D0E14", borderRadius:10, padding:4, marginBottom:24, gap:4 }}>
            {[
              { id:"login", label:"🔑 Login" },
              { id:"register", label:"✨ Register" },
              { id:"google", label:"🔵 Google" },
            ].map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setError(""); }}
                style={{
                  flex:1, padding:"8px 4px", borderRadius:8, border:"none", cursor:"pointer",
                  background: tab === t.id ? "#6C63FF" : "transparent",
                  color: tab === t.id ? "#fff" : "#6B6E85",
                  fontWeight:600, fontSize:12, transition:"all .15s",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Google tab ── */}
          {tab === "google" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"8px 0" }}>
              {GOOGLE_CLIENT_ID ? (
                <>
                  <div ref={googleBtnRef} style={{ minHeight:44 }} />
                  {gLoading && <p style={{ color:"#6B6E85", fontSize:13 }}>⏳ Connecting...</p>}
                </>
              ) : (
                <div style={{ background:"#1A1B26", border:"1px dashed #2A2B38", borderRadius:12, padding:"20px", textAlign:"center", fontSize:13, color:"#6B6E85", width:"100%" }}>
                  ⚙️ Google Sign-in এখনো configure হয়নি।<br/>
                  <span style={{color:"#6C63FF"}}>Settings → GOOGLE_CLIENT_ID</span> সেট করুন।
                </div>
              )}
            </div>
          )}

          {/* ── Login tab ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>USERNAME বা EMAIL</label>
                <input
                  value={form.username} onChange={e=>up("username",e.target.value)}
                  placeholder="admin বা email@example.com" autoFocus
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>PASSWORD</label>
                <div style={{ position:"relative" }}>
                  <input
                    type={showPass?"text":"password"} value={form.password} onChange={e=>up("password",e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight:44 }}
                  />
                  <button type="button" onClick={()=>setShowPass(s=>!s)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#6B6E85", cursor:"pointer", fontSize:14 }}>
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={btnPrimary}>
                {loading ? "⏳ Logging in..." : "Login →"}
              </button>
            </form>
          )}

          {/* ── Register tab ── */}
          {tab === "register" && (
            <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>USERNAME</label>
                <input value={form.username} onChange={e=>up("username",e.target.value)} placeholder="yourname" style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>EMAIL</label>
                <input type="email" value={form.email} onChange={e=>up("email",e.target.value)} placeholder="email@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>PASSWORD</label>
                <div style={{ position:"relative" }}>
                  <input type={showPass?"text":"password"} value={form.password} onChange={e=>up("password",e.target.value)} placeholder="কমপক্ষে 6 অক্ষর" style={{ ...inputStyle, paddingRight:44 }} />
                  <button type="button" onClick={()=>setShowPass(s=>!s)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#6B6E85", cursor:"pointer" }}>
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#6B6E85", fontWeight:600, marginBottom:6, display:"block" }}>CONFIRM PASSWORD</label>
                <input type="password" value={form.confirm} onChange={e=>up("confirm",e.target.value)} placeholder="আবার দিন" style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={btnPrimary}>
                {loading ? "⏳ Creating account..." : "Account বানান →"}
              </button>
              <p style={{ fontSize:12, color:"#6B6E85", textAlign:"center" }}>
                ইতিমধ্যে account আছে?{" "}
                <button type="button" onClick={()=>setTab("login")} style={{ background:"none", border:"none", color:"#6C63FF", cursor:"pointer", fontWeight:600 }}>Login করুন</button>
              </p>
            </form>
          )}

          {error && (
            <div style={{ marginTop:14, background:"#FF6B6B22", border:"1px solid #FF6B6B44", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <p style={{ textAlign:"center", fontSize:11, color:"#3A3B48", marginTop:20 }}>
          By signing in you agree to our{" "}
          <a href="#" style={{color:"#6C63FF"}}>Terms</a> &{" "}
          <a href="#" style={{color:"#6C63FF"}}>Privacy Policy</a>
        </p>
      </div>

      <style>{`
        .login-hero-panel { display: flex !important; }
        @media (max-width: 768px) {
          .login-hero-panel { display: none !important; }
          .mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

const inputStyle = {
  width:"100%", padding:"11px 14px", background:"#0D0E14", border:"1px solid #2A2B38",
  borderRadius:10, color:"#E8E9F0", fontSize:14, outline:"none",
  transition:"border-color .15s",
};

const btnPrimary = {
  padding:"12px", background:"linear-gradient(135deg,#6C63FF,#5A52E0)", color:"#fff",
  border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer",
  transition:"opacity .15s", marginTop:4,
};
