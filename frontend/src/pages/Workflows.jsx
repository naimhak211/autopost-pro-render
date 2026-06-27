import { useState, useEffect } from "react";
import {
  getWorkflows, saveWorkflow, deleteWorkflow, toggleWorkflow,
  runWorkflowNow, runAllWorkflows, getAccounts, bulkToggleWorkflows, getUserDriveStatus,
} from "../api.js";

const DAYS = [
  { code: "SU", label: "রবি" }, { code: "MO", label: "সোম" }, { code: "TU", label: "মঙ্গল" },
  { code: "WE", label: "বুধ" }, { code: "TH", label: "বৃহ" }, { code: "FR", label: "শুক্র" }, { code: "SA", label: "শনি" },
];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "UTC", "America/New_York", "Europe/London"];

const STATUS_META = {
  active:         { label: "✅ Active",         cls: "status-ok" },
  paused:         { label: "⏸ Paused",          cls: "status-warn" },
  not_configured: { label: "⚙ Not Configured",  cls: "status-warn" },
};

const EMPTY = {
  id: null, account_id: "", source_type: "drive", source_value: "", success_folder_id: "",
  videos_per_run: 1, active: true, repeat_mode: "everyday", days_of_week: [], timezone: "Asia/Dhaka", times: ["10:00"],
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [runningAll, setRunningAll] = useState(false);
  const [timeFormat, setTimeFormat] = useState("24h");
  const [driveStatus, setDriveStatus] = useState(null);

  const load = () => {
    Promise.all([getWorkflows(), getAccounts()])
      .then(([w, a]) => { setWorkflows(w); setAccounts(a.filter(x => x.platform === "Facebook")); })
      .catch(() => { setWorkflows([]); setAccounts([]); })
      .finally(() => setLoading(false));
    getUserDriveStatus().then(setDriveStatus).catch(() => {});
  };
  useEffect(load, []);

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ ...EMPTY, account_id: accounts[0]?.id || "" }); setShowModal(true); };
  const openEdit = (w) => {
    setForm({
      id: w.id, account_id: w.account_id, source_type: w.source_type, source_value: w.source_value,
      success_folder_id: w.success_folder_id || "", videos_per_run: w.videos_per_run, active: w.active,
      repeat_mode: w.repeat_mode, days_of_week: w.days_of_week, timezone: w.timezone, times: w.times.length ? w.times : ["10:00"],
    });
    setShowModal(true);
  };

  const toggleDay = (code) => setForm(f => ({
    ...f, days_of_week: f.days_of_week.includes(code) ? f.days_of_week.filter(d => d !== code) : [...f.days_of_week, code]
  }));
  const setTime = (i, val) => setForm(f => ({ ...f, times: f.times.map((t, idx) => idx === i ? val : t) }));
  const addTime = () => setForm(f => ({ ...f, times: [...f.times, "10:00"] }));
  const removeTime = (i) => setForm(f => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.account_id) return alert("একটা Facebook Page বেছে নিন");
    if (!form.source_value.trim()) return alert("Source value (Drive folder link বা TikTok profile URL) দিন");
    setSaving(true);
    try {
      await saveWorkflow(form);
      setShowModal(false);
      load();
    } catch { alert("Save ব্যর্থ হয়েছে"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("এই Workflow মুছে ফেলবেন?")) return;
    await deleteWorkflow(id).catch(() => {});
    load();
  };

  const handleToggle = async (id) => {
    await toggleWorkflow(id).catch(() => {});
    load();
  };

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      await runWorkflowNow(id);
      alert("✅ Workflow রান করা হয়েছে");
      load();
    } catch { alert("❌ রান ব্যর্থ হয়েছে"); }
    setRunningId(null);
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const res = await runAllWorkflows();
      alert(`✅ ${res.ran} টা workflow রান হয়েছে`);
      load();
    } catch { alert("❌ ব্যর্থ হয়েছে"); }
    setRunningAll(false);
  };

  const handleBulkActivate = async () => {
    const ids = workflows.filter(w => !w.active).map(w => w.id);
    if (!ids.length) return;
    await bulkToggleWorkflows(ids, true).catch(() => {});
    load();
  };
  const handleBulkPause = async () => {
    const ids = workflows.filter(w => w.active).map(w => w.id);
    if (!ids.length) return;
    await bulkToggleWorkflows(ids, false).catch(() => {});
    load();
  };

  const fmt = (t) => {
    if (timeFormat === "24h") return t;
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const counts = workflows.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>⚙️ Workflow Engine</h1>
          <p className="subtitle">Drive বা TikTok থেকে অটো ভিডিও পোস্টিং</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn-ghost sm" onClick={handleBulkActivate}>▶ Activate shown</button>
          <button className="btn-ghost sm" onClick={handleBulkPause}>⏸ Pause shown</button>
          <button className="btn-outline" onClick={handleRunAll} disabled={runningAll}>
            {runningAll ? "⏳..." : "▶ Run All Enabled Now"}
          </button>
          <button className="btn-primary" onClick={openNew}>+ নতুন Workflow</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ borderTopColor: "#00C9A7" }}>
          <div className="stat-icon" style={{ background: "#00C9A722" }}>✅</div>
          <div className="stat-info"><p className="stat-value">{counts.active || 0}</p><p className="stat-label">Active</p></div>
        </div>
        <div className="stat-card" style={{ borderTopColor: "#FFA800" }}>
          <div className="stat-icon" style={{ background: "#FFA80022" }}>⏸</div>
          <div className="stat-info"><p className="stat-value">{counts.paused || 0}</p><p className="stat-label">Paused</p></div>
        </div>
        <div className="stat-card" style={{ borderTopColor: "#6C63FF" }}>
          <div className="stat-icon" style={{ background: "#6C63FF22" }}>⚙</div>
          <div className="stat-info"><p className="stat-value">{counts.not_configured || 0}</p><p className="stat-label">Not Configured</p></div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="pulse-ring" /></div>
      ) : workflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⚙️</div>
          <p>কোনো Workflow নেই। উপরে + বাটনে ক্লিক করুন।</p>
        </div>
      ) : (
        <div className="queue-list">
          {workflows.map(w => {
            const st = STATUS_META[w.status] || STATUS_META.not_configured;
            return (
              <div className="queue-item" key={w.id}>
                <div className="queue-file">
                  {w.source_type === "drive" ? "📁" : "🎵"} {w.account_name || "—"}
                  <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({w.account_platform})</span>
                </div>
                <div className="queue-caption" style={{ fontSize: 12 }}>{w.source_value}</div>
                <div className="queue-time">
                  ⏰ {w.times.map(fmt).join(", ")} · {w.timezone} · {w.repeat_mode === "everyday" ? "প্রতিদিন" : w.days_of_week.join(",")}
                  {" · "}{w.videos_per_run}টা/রান
                </div>
                <div className="queue-actions">
                  <span className={st.cls} style={{ fontSize: 11 }}>{st.label}</span>
                  <button className="btn-ghost sm" onClick={() => handleRunNow(w.id)} disabled={runningId === w.id}>
                    {runningId === w.id ? "⏳" : "▶"}
                  </button>
                  <button className="btn-ghost sm" onClick={() => handleToggle(w.id)}>{w.active ? "⏸" : "▶"}</button>
                  <button className="btn-ghost sm" onClick={() => openEdit(w)}>✏️</button>
                  <button className="btn-ghost sm" onClick={() => handleDelete(w.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>{form.id ? "Workflow Edit করুন" : "নতুন Workflow তৈরি করুন"}</h2>

            <label>Facebook Page</label>
            <select value={form.account_id} onChange={e => up("account_id", Number(e.target.value))}>
              <option value="">— বেছে নিন —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {accounts.length === 0 && (
              <p className="muted" style={{ fontSize: 11 }}>কোনো Facebook Page নেই — আগে Accounts বা Profiles পেজ থেকে একটা যোগ করুন</p>
            )}

            <label>🌐 সোর্স</label>
            <div className="platform-picker">
              <button className={`plat-pick-btn ${form.source_type === "drive" ? "selected" : ""}`} onClick={() => up("source_type", "drive")}>📁 Google Drive</button>
              <button className={`plat-pick-btn ${form.source_type === "tiktok" ? "selected" : ""}`} onClick={() => up("source_type", "tiktok")}>🎵 TikTok Profile</button>
            </div>
            {form.source_type === "drive" && driveStatus && !driveStatus.configured && (
              <p className="tip-box" style={{ fontSize:11, marginTop:8 }}>
                ⚠️ Google Drive key configure করা হয়নি।{" "}
                <b style={{ color:"var(--accent)", cursor:"pointer" }}>My Profile</b> পেজে গিয়ে Drive JSON upload করুন।
              </p>
            )}

            {form.source_type === "drive" ? (
              <>
                <label>Google Drive Folder ID/Link</label>
                <input placeholder="Folder ID অথবা পুরো লিংক" value={form.source_value} onChange={e => up("source_value", e.target.value)} />
                <p className="muted" style={{ fontSize: 11 }}>✨ ভিডিও পুরাতন→নতুন ক্রমে পোস্ট হবে, তারপর 'success' সাবফোল্ডারে সরানো হবে। শিরোনাম আসবে ফাইলের নাম থেকে।</p>
                <label>Success ফোল্ডার ID (optional)</label>
                <input placeholder="পোস্ট হওয়ার পর ভিডিও এখানে সরবে" value={form.success_folder_id} onChange={e => up("success_folder_id", e.target.value)} />
              </>
            ) : (
              <>
                <label>TikTok Profile URL</label>
                <input placeholder="https://www.tiktok.com/@username" value={form.source_value} onChange={e => up("source_value", e.target.value)} />
                <p className="muted" style={{ fontSize: 11 }}>🎬 ভিডিও পুরাতন→নতুন ক্রমে ডাউনলোড ও পোস্ট হবে, একবার পোস্ট হলে আর রিপোস্ট হবে না। নতুন ভিডিও শেষ হলে workflow auto-pause হবে।</p>
                <p className="tip-box" style={{ fontSize: 11 }}>⚠️ শুধু নিজের বা অনুমতি থাকা প্রোফাইল ব্যবহার করুন — অন্যের কনটেন্ট রিপোস্ট করলে পেজ demote হতে পারে।</p>
              </>
            )}

            <label>⚙️ প্রতি রানে কয়টা ভিডিও</label>
            <input type="number" min="1" max="10" value={form.videos_per_run} onChange={e => up("videos_per_run", Number(e.target.value))} />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={form.active} onChange={e => up("active", e.target.checked)} style={{ width: "auto" }} />
              Active (পজ করতে আনচেক করুন)
            </label>

            <label style={{ marginTop: 14 }}>📅 Repeat</label>
            <select value={form.repeat_mode} onChange={e => up("repeat_mode", e.target.value)}>
              <option value="everyday">Everyday</option>
              <option value="specific_days">Specific Days</option>
            </select>

            {form.repeat_mode === "specific_days" && (
              <div className="platform-picker" style={{ marginTop: 8 }}>
                {DAYS.map(d => (
                  <button key={d.code} className={`plat-pick-btn ${form.days_of_week.includes(d.code) ? "selected" : ""}`}
                    onClick={() => toggleDay(d.code)}>{d.label}</button>
                ))}
              </div>
            )}

            <label>Timezone</label>
            <select value={form.timezone} onChange={e => up("timezone", e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>

            <label>⏰ Times</label>
            <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
              <span className="muted" style={{ fontSize:12 }}>Format:</span>
              <button className={`chip ${timeFormat==="ampm"?"chip-active":""}`} onClick={()=>setTimeFormat("ampm")}>AM/PM</button>
              <button className={`chip ${timeFormat==="24h"?"chip-active":""}`} onClick={()=>setTimeFormat("24h")}>24h</button>
            </div>
            {form.times.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input type="time" style={{ flex: 1 }} value={t} onChange={e => setTime(i, e.target.value)} />
                {timeFormat === "ampm" && <span className="muted" style={{ fontSize:12, alignSelf:"center" }}>{fmt(t)}</span>}
                {form.times.length > 1 && (
                  <button type="button" className="btn-ghost sm" onClick={() => removeTime(i)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-outline sm" onClick={addTime}>+ Add time</button>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>বাতিল</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "⏳ সেভ হচ্ছে..." : "💾 Save Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
