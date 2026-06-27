import { useState, useEffect } from "react";
import { getProfiles, addProfile, deleteProfile, fbOAuthStartUrl } from "../api.js";

const EMPTY_FORM = { name: "", app_id: "", app_secret: "" };

export default function Profiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    getProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async () => {
    if (!form.name.trim() || !form.app_id.trim() || !form.app_secret.trim())
      return alert("Profile Name, App ID ও App Secret সবগুলো দিন");
    setSaving(true);
    try {
      await addProfile(form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch { alert("যোগ করা ব্যর্থ হয়েছে"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("এই প্রোফাইল মুছে ফেলবেন? এর সাথে যুক্ত পেজগুলো আর auto-sync হবে না।")) return;
    await deleteProfile(id).catch(() => {});
    load();
  };

  const handleConnect = (profile) => {
    window.open(fbOAuthStartUrl(profile.id), "_blank", "width=600,height=700");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🛡️ Facebook Profiles</h1>
          <p className="subtitle">প্রতিটা প্রোফাইলের নিজস্ব Facebook App — OAuth লগইন করলে পেজ অটো-পুল হয়</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ নতুন Profile</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="pulse-ring" /><p>লোড হচ্ছে...</p></div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <p>🛡️ এখনো কোনো Profile নেই</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>প্রথম Profile বানান</button>
        </div>
      ) : (
        <div className="accounts-grid">
          {profiles.map(p => (
            <div className="account-card" key={p.id}>
              <div className="acc-header" style={{ borderLeftColor: "#1877F2" }}>
                <span className="acc-platform-icon" style={{ background: "#1877F222" }}>🛡️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="acc-name">{p.name}</p>
                  <p className="acc-meta">App ID: {p.app_id}</p>
                </div>
                <span className={p.connected ? "status-ok" : "status-warn"} style={{ fontSize: 11 }}>
                  {p.connected ? "🟢 Connected" : "⚪ Not logged in"}
                </span>
              </div>
              <div className="acc-actions">
                <button className="btn-outline" onClick={() => handleConnect(p)}>
                  🔐 {p.connected ? "Re-login" : "Login with Facebook"}
                </button>
                <button className="btn-ghost" onClick={() => handleDelete(p.id)}>🗑️ মুছুন</button>
              </div>
            </div>
          ))}
          <div className="account-card add-card" onClick={() => setShowModal(true)}>
            <div className="add-icon">+</div>
            <p>নতুন Profile যোগ করুন</p>
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="card">
        <h3 style={{ cursor: "pointer" }} onClick={() => setShowGuide(g => !g)}>
          ▸ Facebook App কীভাবে বানাবেন (App ID ও Secret পাওয়ার জন্য) {showGuide ? "▲" : "▼"}
        </h3>
        {showGuide && (
          <ol style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 18, color: "var(--text)" }}>
            <li><b>Meta for Developers</b> খুলুন — developers.facebook.com/apps</li>
            <li><b>Create App</b> → Type: <b>Business</b> → Next → নাম+ইমেইল দিয়ে Create App</li>
            <li>Dashboard থেকে <b>Facebook Login for Business</b> → Set up</li>
            <li><b>Facebook Login → Settings</b> → Valid OAuth Redirect URIs-এ বসান:<br />
              <code>{`{BACKEND_PUBLIC_URL}/api/fb/callback`}</code></li>
            <li><b>App settings → Basic</b> → Privacy Policy URL ও Terms of Service URL বসান (নিচে built-in পেজ আছে)</li>
            <li>একই পেজ থেকে <b>App ID</b> কপি করুন, <b>App Secret</b>-এ Show চেপে কপি করুন</li>
            <li>এখানে + নতুন Profile-এ পেস্ট করে Save করুন, তারপর Login with Facebook চাপুন</li>
            <li><b>App Review → Permissions</b>-এ `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management` যোগ করুন</li>
          </ol>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          💡 নিজের পেজের জন্য App-টা <b>Development</b> মোডে রাখলেই হবে — Facebook review লাগবে না।
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>নতুন Facebook Profile</h2>

            <label>Profile Name</label>
            <input placeholder="যেমন: আমার মূল বিজনেস" value={form.name} onChange={e => up("name", e.target.value)} />

            <label>App ID</label>
            <input placeholder="1234567890123456" value={form.app_id} onChange={e => up("app_id", e.target.value)} />

            <label>App Secret</label>
            <input type="password" placeholder="App Secret পেস্ট করুন" value={form.app_secret} onChange={e => up("app_secret", e.target.value)} />

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>বাতিল</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? "⏳ যোগ হচ্ছে..." : "✅ Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
