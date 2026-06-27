import { useState, useEffect } from "react";
import {
  getProfiles, addProfile, deleteProfile, fbOAuthStartUrl,
  getAccounts, addAccount, deleteAccount, testAccount, syncAllAccounts,
  getPagesTable,
} from "../api.js";

const EMPTY_PROFILE = { name: "", app_id: "", app_secret: "", access_token: "" };
const EMPTY_TOKEN   = { platform: "Facebook", name: "", type: "Page", token: "", page_id: "", ig_user_id: "" };
const WF_COLOR = { active: "var(--accent2)", not_configured: "var(--warn)", paused: "var(--warn)" };

export default function PagesAccounts() {
  const [tab, setTab]           = useState("pages"); // pages | accounts
  const [profiles, setProfiles] = useState([]);
  const [pages, setPages]       = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [filter, setFilter]     = useState("All");
  const [search, setSearch]     = useState("");

  // modals
  const [showProfile, setShowProfile] = useState(false);
  const [showToken, setShowToken]     = useState(false);
  const [formP, setFormP] = useState(EMPTY_PROFILE);
  const [formT, setFormT] = useState(EMPTY_TOKEN);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  const load = () => {
    Promise.all([getProfiles(), getAccounts(), getPagesTable()])
      .then(([p, a, pg]) => { setProfiles(p); setAccounts(a); setPages(pg); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSync = async () => {
    setSyncing(true);
    try { await syncAllAccounts(); load(); } catch {}
    setSyncing(false);
  };

  // Profiles
  const saveProfile = async () => {
    if (!formP.name || !formP.app_id || !formP.app_secret) return alert("Name, App ID ও App Secret দিন");
    setSaving(true);
    try {
      await addProfile(formP);
      setShowProfile(false); setFormP(EMPTY_PROFILE); load();
    } catch { alert("সেভ ব্যর্থ"); }
    setSaving(false);
  };
  const delProfile = async (id) => {
    if (!confirm("এই Profile মুছবেন?")) return;
    await deleteProfile(id).catch(() => {}); load();
  };

  // Token accounts
  const saveToken = async () => {
    if (!formT.token) return alert("Access Token দিন");
    setSaving(true);
    try {
      await addAccount(formT);
      setShowToken(false); setFormT(EMPTY_TOKEN); load();
    } catch { alert("সেভ ব্যর্থ"); }
    setSaving(false);
  };
  const delAccount = async (id) => {
    if (!confirm("এই Account মুছবেন?")) return;
    await deleteAccount(id).catch(() => {}); load();
  };
  const handleTest = async (acc) => {
    setTesting(acc.id);
    try {
      const d = await testAccount(acc.id);
      alert(d.success ? `✅ সংযোগ সফল!${d.pages ? "\nPages: " + d.pages.map(p=>p.name).join(", ") : ""}` : "❌ " + (d.error || "ব্যর্থ"));
    } catch { alert("❌ Test ব্যর্থ"); }
    setTesting(null);
  };

  const visiblePages = pages.filter(p => {
    const ms = filter === "All" || p.status === filter || p.workflow_status === filter;
    const ms2 = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    return ms && ms2;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>👥 Pages &amp; Accounts</h1><p className="subtitle">Manage your Facebook identities and page access.</p></div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-outline" onClick={handleSync} disabled={syncing}>{syncing ? "⏳..." : "↻ Sync All"}</button>
          <button className="btn-outline" onClick={() => setShowToken(true)}>🔑 Add by Token</button>
          <button className="btn-primary" onClick={() => setShowProfile(true)}>+ Add Account</button>
        </div>
      </div>

      {/* Profiles (OAuth apps) */}
      {profiles.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>🛡️ Connected Profiles</h3>
          <div className="accounts-grid">
            {profiles.map(p => (
              <div className="account-card" key={p.id}>
                <div className="acc-header" style={{ borderLeftColor: "#1877F2" }}>
                  <span className="acc-platform-icon" style={{ background:"#1877F222" }}>🛡️</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p className="acc-name">{p.name}</p>
                    <p className="acc-meta" style={{ fontSize:11 }}>App ID: {p.app_id}</p>
                  </div>
                  <span style={{ fontSize:11, color: p.connected ? "var(--accent2)" : "var(--muted)" }}>
                    {p.connected ? "🟢 Connected" : "⚪ Not logged in"}
                  </span>
                </div>
                <div className="acc-actions">
                  <button className="btn-outline" onClick={() => window.open(fbOAuthStartUrl(p.id), "_blank", "width=620,height=700")}>
                    🔐 {p.connected ? "Re-login" : "Login with Facebook"}
                  </button>
                  <button className="btn-ghost sm" onClick={() => delProfile(p.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Pages | All Accounts */}
      <div className="tab-row">
        <button className={`tab-btn ${tab==="pages"?"active":""}`} onClick={() => setTab("pages")}>📄 Pages</button>
        <button className={`tab-btn ${tab==="accounts"?"active":""}`} onClick={() => setTab("accounts")}>🔗 Token Accounts</button>
      </div>

      {/* Pages Table */}
      {tab === "pages" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
            <input placeholder="🔍 পেজ খুঁজুন..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:"0 0 200px" }} />
            {["All","connected","active","paused"].map(s => (
              <button key={s} className={`chip ${filter===s?"chip-active":""}`} onClick={()=>setFilter(s)}>{s}</button>
            ))}
            <span className="muted" style={{ fontSize:12, marginLeft:"auto" }}>{visiblePages.length} PAGES FOUND</span>
            <button className="btn-ghost sm" onClick={load}>↻ Refresh</button>
          </div>
          {loading ? <div className="empty-state"><div className="pulse-ring" /></div>
           : visiblePages.length === 0 ? (
            <div className="empty-state">
              <p>📄 কোনো Page নেই। "+ Add Account" দিয়ে Profile তৈরি করে Facebook Login করুন।</p>
            </div>
          ) : (
            <div className="pages-table-wrap">
              <table className="pages-table">
                <thead><tr><th>PAGE</th><th>FOLLOWERS</th><th>GROWTH</th><th>SCHED</th><th>POSTS</th><th>NEXT POST</th><th>STATUS</th><th></th></tr></thead>
                <tbody>
                  {visiblePages.map(p => (
                    <tr key={p.id}>
                      <td><div className="page-cell"><span className="page-avatar">📘</span><div><p className="page-name">{p.name}</p><p className="muted" style={{fontSize:11}}>{p.page_id||"—"}</p></div></div></td>
                      <td>{p.followers?.toLocaleString()||"—"}</td>
                      <td style={{color: p.growth_pct>0?"var(--accent2)":p.growth_pct<0?"var(--danger)":undefined}}>
                        {p.growth_pct!=null?`${p.growth_pct>0?"+":""}${p.growth_pct}%`:"—"}
                      </td>
                      <td><span style={{color:WF_COLOR[p.workflow_status]||"var(--muted)",fontSize:12}}>
                        {p.workflow_status==="active"?"✅ Active":p.workflow_status==="paused"?"⏸ Paused":"⚙ None"}</span></td>
                      <td><span style={{color:"var(--accent2)"}}>{p.total_posts||0}</span>{p.failed_posts>0&&<span style={{color:"var(--danger)",marginLeft:4}}>/{p.failed_posts}✗</span>}</td>
                      <td style={{fontSize:12}}>{p.next_post||"—"}</td>
                      <td><span className={p.status==="connected"?"status-ok":"status-err"} style={{fontSize:11}}>{p.status==="connected"?"🟢 Connected":"🔴 "+p.status}</span></td>
                      <td><button className="btn-ghost sm" onClick={()=>delAccount(p.id)}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Token Accounts */}
      {tab === "accounts" && (
        <>
          {accounts.length === 0 ? (
            <div className="empty-state"><p>🔑 কোনো Token Account নেই। "Add by Token" দিয়ে যোগ করুন।</p></div>
          ) : (
            <div className="accounts-grid">
              {accounts.map(a => (
                <div className="account-card" key={a.id}>
                  <div className="acc-header" style={{borderLeftColor:"#1877F2"}}>
                    <span className="acc-platform-icon">📘</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p className="acc-name">{a.name||a.platform}</p>
                      <p className="acc-meta">{a.platform} · {a.type}</p>
                    </div>
                    <span className={a.status==="connected"?"status-ok":"status-warn"} style={{fontSize:11}}>
                      {a.status==="connected"?"🟢 Connected":"🔴 Expired"}
                    </span>
                  </div>
                  <div className="acc-stats">
                    <div className="acc-stat"><p className="acc-stat-val">{a.followers?.toLocaleString()||"—"}</p><p className="acc-stat-lbl">Followers</p></div>
                    <div className="acc-stat"><p className="acc-stat-val" style={{color:a.growth_pct>0?"var(--accent2)":undefined}}>{a.growth_pct!=null?`${a.growth_pct>0?"+":""}${a.growth_pct}%`:"—"}</p><p className="acc-stat-lbl">Growth</p></div>
                    <div className="acc-stat"><p className="acc-stat-val">{a.total_posts||0}</p><p className="acc-stat-lbl">Posts</p></div>
                  </div>
                  <div className="acc-actions">
                    <button className="btn-outline" onClick={()=>handleTest(a)} disabled={testing===a.id}>{testing===a.id?"⏳ Testing...":"🧪 Test"}</button>
                    <button className="btn-ghost sm" onClick={()=>delAccount(a.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Profile Modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={()=>setShowProfile(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>Add Profile</h2>
            <p className="muted" style={{fontSize:13,marginBottom:14}}>This profile uses its OWN Facebook App — paste that app's ID &amp; secret below.</p>
            <label>Profile Name</label>
            <input placeholder="যেমন: আমার বিজনেস" value={formP.name} onChange={e=>setFormP(f=>({...f,name:e.target.value}))} />
            <label>App ID (this profile's own)</label>
            <input placeholder="1234567890" value={formP.app_id} onChange={e=>setFormP(f=>({...f,app_id:e.target.value}))} />
            <label>App Secret (this profile's own)</label>
            <input type="password" placeholder="App Secret" value={formP.app_secret} onChange={e=>setFormP(f=>({...f,app_secret:e.target.value}))} />
            <label>Access Token (User / System-User token)</label>
            <input placeholder="Optional — OAuth login করলে auto-fill হবে" value={formP.access_token} onChange={e=>setFormP(f=>({...f,access_token:e.target.value}))} />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setShowProfile(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveProfile} disabled={saving}>{saving?"⏳...":"💾 Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add by Token Modal */}
      {showToken && (
        <div className="modal-overlay" onClick={()=>setShowToken(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>🔑 Add by Token</h2>
            <label>Platform</label>
            <select value={formT.platform} onChange={e=>setFormT(f=>({...f,platform:e.target.value}))}>
              {["Facebook","Instagram","TikTok","YouTube Shorts"].map(p=><option key={p}>{p}</option>)}
            </select>
            <label>Name</label>
            <input placeholder="Page / Account name" value={formT.name} onChange={e=>setFormT(f=>({...f,name:e.target.value}))} />
            <label>Page Access Token</label>
            <input type="password" placeholder="EAA..." value={formT.token} onChange={e=>setFormT(f=>({...f,token:e.target.value}))} />
            {formT.platform==="Facebook"&&<><label>Page ID</label><input placeholder="123456789" value={formT.page_id} onChange={e=>setFormT(f=>({...f,page_id:e.target.value}))} /></>}
            {formT.platform==="Instagram"&&<><label>Instagram User ID</label><input placeholder="IG User ID" value={formT.ig_user_id} onChange={e=>setFormT(f=>({...f,ig_user_id:e.target.value}))} /></>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setShowToken(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveToken} disabled={saving}>{saving?"⏳...":"💾 Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
