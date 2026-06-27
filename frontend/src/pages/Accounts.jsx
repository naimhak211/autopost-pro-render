import { useState, useEffect } from "react";
import { getAccounts, addAccount, deleteAccount, testAccount, syncAllAccounts } from "../api.js";

const PLATFORMS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts"];
const PLAT_META = {
  Facebook:        { icon: "📘", color: "#1877F2" },
  Instagram:       { icon: "📸", color: "#E1306C" },
  TikTok:          { icon: "🎵", color: "#6366f1" },
  "YouTube Shorts":{ icon: "▶️", color: "#FF0000" },
};

const EMPTY_FORM = { platform: "Facebook", name: "", type: "Page", token: "", page_id: "", ig_user_id: "" };

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(null);
  const [syncing, setSyncing]   = useState(false);

  const load = () => {
    getAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!form.token.trim()) return alert("Access Token দিন");
    setSaving(true);
    try {
      await addAccount(form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch { alert("যোগ করা ব্যর্থ হয়েছে"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("এই অ্যাকাউন্ট মুছে ফেলবেন?")) return;
    await deleteAccount(id).catch(() => {});
    load();
  };

  const handleTest = async (acc) => {
    setTesting(acc.id);
    try {
      const data = await testAccount(acc.id);
      if (data.success) {
        const pages = data.pages?.map(p => p.name).join(", ");
        alert(`✅ সংযোগ সফল!${pages ? "\nপেজ: " + pages : ""}`);
      } else {
        alert("❌ " + (data.error || "সংযোগ ব্যর্থ"));
      }
    } catch { alert("❌ টেস্ট ব্যর্থ"); }
    setTesting(null);
  };

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await syncAllAccounts();
      alert(`✅ ${res.synced} টা Facebook Page sync হয়েছে`);
      load();
    } catch { alert("❌ Sync ব্যর্থ হয়েছে"); }
    setSyncing(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🔗 অ্যাকাউন্ট ম্যানেজমেন্ট</h1>
          <p className="subtitle">সব সোশ্যাল মিডিয়া একসাথে পরিচালনা</p>
        </div>
        <button className="btn-outline" onClick={handleSyncAll} disabled={syncing} style={{ marginRight: 8 }}>
          {syncing ? "⏳ Sync হচ্ছে..." : "↻ Sync All"}
        </button>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ নতুন অ্যাকাউন্ট</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="pulse-ring" /><p>লোড হচ্ছে...</p></div>
      ) : (
        <div className="accounts-grid">
          {accounts.map(acc => {
            const meta = PLAT_META[acc.platform] || { icon: "📤", color: "#6C63FF" };
            return (
              <div className="account-card" key={acc.id}>
                <div className="acc-header" style={{ borderLeftColor: meta.color }}>
                  <span className="acc-platform-icon" style={{ background: meta.color + "22" }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="acc-name">{acc.name || acc.platform}</p>
                    <p className="acc-meta">{acc.platform} · {acc.type}</p>
                  </div>
                  <span className={acc.status === "connected" ? "status-ok" : "status-warn"} style={{ fontSize: 11 }}>
                    {acc.status === "connected" ? "🟢 সক্রিয়" : "🔴 মেয়াদ শেষ"}
                  </span>
                </div>
                <div className="acc-stats">
                  <div className="acc-stat"><p className="acc-stat-val">{acc.followers ?? "—"}</p><p className="acc-stat-lbl">ফলোয়ার</p></div>
                  <div className="acc-stat">
                    <p className="acc-stat-val" style={{ color: acc.growth_pct > 0 ? "var(--accent2)" : acc.growth_pct < 0 ? "var(--danger)" : undefined }}>
                      {acc.growth_pct != null ? `${acc.growth_pct > 0 ? "+" : ""}${acc.growth_pct}%` : "—"}
                    </p>
                    <p className="acc-stat-lbl">গ্রোথ</p>
                  </div>
                  <div className="acc-stat"><p className="acc-stat-val">{acc.last_synced_at ? "✅" : "—"}</p><p className="acc-stat-lbl">Synced</p></div>
                </div>
                <div className="acc-actions">
                  <button className="btn-outline" onClick={() => handleTest(acc)} disabled={testing === acc.id}>
                    {testing === acc.id ? "⏳" : "🔌 টেস্ট"}
                  </button>
                  <button className="btn-ghost" onClick={() => handleDelete(acc.id)}>🗑️ মুছুন</button>
                </div>
              </div>
            );
          })}
          <div className="account-card add-card" onClick={() => setShowModal(true)}>
            <div className="add-icon">+</div>
            <p>নতুন অ্যাকাউন্ট যোগ করুন</p>
          </div>
        </div>
      )}

      {/* API Help */}
      <div className="card">
        <h3>📌 Token কোথায় পাবেন?</h3>
        <div className="platform-list" style={{ gap: 8 }}>
          <div className="platform-row">
            <span>📘</span>
            <span style={{ flex: 1, fontSize: 13 }}>
              <b>Facebook/Instagram:</b> developers.facebook.com → Graph API Explorer → Generate Token
            </span>
          </div>
          <div className="platform-row">
            <span>🎵</span>
            <span style={{ flex: 1, fontSize: 13 }}>
              <b>TikTok:</b> developers.tiktok.com → My Apps → OAuth Access Token (scope: video.publish)
            </span>
          </div>
          <div className="platform-row">
            <span>▶️</span>
            <span style={{ flex: 1, fontSize: 13 }}>
              <b>YouTube:</b> console.cloud.google.com → YouTube Data API v3 → OAuth2 Token (scope: youtube.upload)
            </span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>নতুন অ্যাকাউন্ট যোগ করুন</h2>

            <label>প্ল্যাটফর্ম</label>
            <div className="platform-picker">
              {PLATFORMS.map(p => (
                <button key={p}
                  className={`plat-pick-btn ${form.platform === p ? "selected" : ""}`}
                  onClick={() => up("platform", p)}>
                  {PLAT_META[p]?.icon} {p}
                </button>
              ))}
            </div>

            <label>পেজ / চ্যানেলের নাম</label>
            <input placeholder="My Business Page" value={form.name} onChange={e => up("name", e.target.value)} />

            <label>ধরন</label>
            <select value={form.type} onChange={e => up("type", e.target.value)}>
              <option>Page</option><option>Profile</option>
              <option>Business</option><option>Creator</option><option>Channel</option>
            </select>

            <label>Access Token</label>
            <input type="password" placeholder="API Access Token পেস্ট করুন"
              value={form.token} onChange={e => up("token", e.target.value)} />

            {form.platform === "Facebook" && (
              <>
                <label>Page ID (optional — না দিলে auto detect)</label>
                <input placeholder="123456789" value={form.page_id} onChange={e => up("page_id", e.target.value)} />
              </>
            )}
            {form.platform === "Instagram" && (
              <>
                <label>Instagram User ID</label>
                <input placeholder="17841400000000000" value={form.ig_user_id} onChange={e => up("ig_user_id", e.target.value)} />
              </>
            )}

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>বাতিল</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? "⏳ যোগ হচ্ছে..." : "✅ যোগ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
