import { useState, useEffect } from "react";
import { getMe, getStats, adminGetUsers, adminAddCredits } from "../api.js";
import { getUserInfo } from "../api.js";

export default function Billing() {
  const [me, setMe]         = useState(null);
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [amount, setAmount] = useState("");
  const [selUser, setSelUser] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg]       = useState("");

  const isAdmin = getUserInfo()?.role === "admin";

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    getStats().then(setStats).catch(() => {});
    if (isAdmin) adminGetUsers().then(setUsers).catch(() => {});
  }, []);

  const handleAdd = async () => {
    const n = parseInt(amount);
    if (!n || n < 1) return alert("Valid amount দিন");
    if (!selUser) return alert("User বেছে নিন");
    setAdding(true);
    try {
      const r = await adminAddCredits(parseInt(selUser), n);
      if (r.success) { setMsg(`✅ ${n} credits যোগ হয়েছে`); setAmount(""); getMe().then(setMe).catch(()=>{}); }
    } catch { setMsg("❌ ব্যর্থ হয়েছে"); }
    setAdding(false);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>💳 Billing</h1><p className="subtitle">Credits balance ও usage</p></div>
      </div>

      {/* My credits hero */}
      <div className="billing-hero">
        <div className="credit-orb">
          <span className="credit-icon">💎</span>
          <span className="credit-num">{me?.credits ?? "—"}</span>
        </div>
        <p className="credit-label">My Credits</p>
        <p className="credit-note">1 credit = 1 successful video post</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: "Total Posts",    value: stats.total_posts,  icon: "📤", color: "#6C63FF" },
            { label: "Successful",     value: stats.success,      icon: "✅", color: "#00C9A7" },
            { label: "Failed",         value: stats.failed,       icon: "❌", color: "#FF6B6B" },
            { label: "Success Rate",   value: stats.success_rate + "%", icon: "📈", color: "#6C63FF" },
          ].map(s => (
            <div className="stat-card" key={s.label} style={{ borderTopColor: s.color }}>
              <div className="stat-icon" style={{ background: s.color + "22" }}>{s.icon}</div>
              <div><p className="stat-value">{s.value}</p><p className="stat-label">{s.label}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Admin: add credits to any user */}
      {isAdmin && (
        <div className="card">
          <h3>➕ User-এ Credits যোগ করুন</h3>
          {msg && <p style={{ fontSize:13, color: msg.startsWith("✅") ? "var(--accent2)" : "var(--danger)", marginBottom:10 }}>{msg}</p>}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <select style={{ flex:"0 0 200px" }} value={selUser} onChange={e=>setSelUser(e.target.value)}>
              <option value="">— User বেছে নিন —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.credits} credits)</option>)}
            </select>
            <input type="number" min="1" placeholder="Amount" value={amount}
              onChange={e=>setAmount(e.target.value)} style={{ flex:"0 0 120px" }}/>
            <button className="btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? "⏳" : "➕ Add Credits"}
            </button>
          </div>
        </div>
      )}

      {/* Non-admin: contact info */}
      {!isAdmin && (
        <div className="card" style={{ textAlign:"center", padding:32 }}>
          <p style={{ fontSize:18, marginBottom:12 }}>💎 Credits শেষ হয়ে গেছে?</p>
          <p className="muted" style={{ marginBottom:20 }}>আরো credits পেতে Admin-এর সাথে যোগাযোগ করুন।</p>
          <button className="btn-primary" onClick={() => window.location.hash = "#contact"}>
            ✉️ Contact Us
          </button>
        </div>
      )}

      {/* Credits info */}
      <div className="card">
        <h3>📋 Credits কীভাবে কাজ করে</h3>
        <div style={{ fontSize:13, lineHeight:2, color:"var(--muted)" }}>
          <p>✅ সফল পোস্ট = 1 credit deduct</p>
          <p>❌ Failed পোস্ট = credit কাটে না</p>
          <p>⚙️ Workflow ও manual schedule উভয়ই credits ব্যবহার করে</p>
          <p>💡 0 credits-এ posting চলতে থাকবে, শুধু tracking এর জন্য</p>
        </div>
      </div>
    </div>
  );
}
