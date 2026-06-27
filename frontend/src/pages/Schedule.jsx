import { useState, useEffect } from "react";
import { getSchedules, createSchedule, deleteSchedule, generateSeoAI } from "../api.js";

const PLAT_ICONS = { Facebook:"📘", Instagram:"📸", TikTok:"🎵", YouTube:"▶️", "YouTube Shorts":"▶️" };
const DAYS = ["রবি","সোম","মঙ্গল","বুধ","বৃহ","শুক্র","শনি"];
const EMPTY = { file_name:"", drive_url:"", platforms:[], scheduled_time:"", caption:"", title:"", repeat:"once" };

export default function Schedule() {
  const [queue, setQueue]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [genTitle, setGenTitle] = useState(false);

  const load = () => {
    getSchedules()
      .then(setQueue)
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const togglePlatform = (p) => setForm(f => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p]
  }));

  const handleAdd = async () => {
    if (!form.scheduled_time) return alert("সময় বেছে নিন");
    if (!form.platforms.length) return alert("কমপক্ষে একটি প্ল্যাটফর্ম বেছে নিন");
    if (!form.drive_url && !form.file_name) return alert("Drive URL বা ফাইলের নাম দিন");
    setSaving(true);
    try {
      await createSchedule({
        ...form,
        file_name: form.file_name || form.drive_url.split("/").pop() || "video.mp4",
      });
      setShowForm(false);
      setForm(EMPTY);
      load();
    } catch { alert("শিডিউল তৈরি ব্যর্থ"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("এই শিডিউল বাতিল করবেন?")) return;
    await deleteSchedule(id).catch(() => {});
    load();
  };

  // ── সেমি-অটো: এক ক্লিকে AI দিয়ে SEO title বানিয়ে ফর্মে বসিয়ে দেয় ──
  const handleGenerateTitle = async () => {
    const topic = form.caption.trim() || form.file_name.trim();
    if (!topic) return alert("আগে ক্যাপশন বা ফাইলের নাম দিন, তারপর AI title বানাবে");
    setGenTitle(true);
    try {
      const seoPlatform = form.platforms.includes("YouTube Shorts") ? "YouTube" : (form.platforms[0] || "Facebook");
      const res = await generateSeoAI({ topic, platform: seoPlatform });
      if (!res.success) throw new Error(res.error);
      setForm(f => ({ ...f, title: res.seo_title }));
    } catch {
      alert("SEO title তৈরি ব্যর্থ হয়েছে। backend-এ ANTHROPIC_API_KEY সেট আছে কিনা চেক করুন।");
    }
    setGenTitle(false);
  };

  const statusBadge = (s) => {
    const map = { pending:"⏳ অপেক্ষায়", done:"✅ সম্পন্ন", failed:"❌ ব্যর্থ" };
    const cls = { pending:"badge-pending", done:"badge-success", failed:"badge-failed" };
    return <span className={`badge ${cls[s] || "badge-pending"}`}>{map[s] || s}</span>;
  };

  // Count schedules per day of week
  const dayCount = Array(7).fill(0);
  queue.forEach(q => {
    if (q.scheduled_time) {
      const d = new Date(q.scheduled_time).getDay();
      dayCount[d]++;
    }
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>📅 শিডিউল ম্যানেজার</h1>
          <p className="subtitle">নির্দিষ্ট সময়ে অটো পোস্ট হবে</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ নতুন শিডিউল</button>
      </div>

      {/* Weekly overview */}
      <div className="card">
        <h3>সাপ্তাহিক ওভারভিউ</h3>
        <div className="week-grid">
          {DAYS.map((d, i) => (
            <div className={`day-cell ${i === new Date().getDay() ? "today" : ""}`} key={d}>
              <p className="day-name">{d}</p>
              <p className="day-count">{dayCount[i]}</p>
              <p className="day-lbl">পোস্ট</p>
            </div>
          ))}
        </div>
      </div>

      {/* Queue list */}
      <div className="card">
        <h3>শিডিউল কিউ ({queue.length}টি)</h3>
        {loading ? (
          <div className="empty-state"><div className="pulse-ring" /></div>
        ) : queue.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>কোনো শিডিউল নেই। উপরে + বাটনে ক্লিক করুন।</p>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map(item => (
              <div className="queue-item" key={item.id}>
                <div className="queue-file">🎬 {item.file_name}</div>
                <div className="queue-platforms">
                  {(Array.isArray(item.platforms) ? item.platforms : []).map(p => (
                    <span className="plat-pill" key={p}>{PLAT_ICONS[p]} {p}</span>
                  ))}
                </div>
                <div className="queue-time">⏰ {item.scheduled_time?.slice(0,16).replace("T"," ")}</div>
                {item.caption && (
                  <div className="queue-caption">"{item.caption.slice(0,50)}..."</div>
                )}
                <div className="queue-actions">
                  {statusBadge(item.status)}
                  <button className="btn-ghost sm" onClick={() => handleDelete(item.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <h2>নতুন শিডিউল তৈরি করুন</h2>

            <label>Google Drive ভিডিও URL</label>
            <input
              placeholder="https://drive.google.com/file/d/.../view"
              value={form.drive_url}
              onChange={e => setForm(f => ({
                ...f, drive_url: e.target.value,
                file_name: f.file_name || e.target.value.split("/").filter(Boolean).slice(-2,-1)[0] || "video.mp4"
              }))}
            />

            <label>ফাইলের নাম (optional)</label>
            <input placeholder="promo_video.mp4" value={form.file_name}
              onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))} />

            <label>প্ল্যাটফর্ম</label>
            <div className="platform-picker">
              {["Facebook","Instagram","TikTok","YouTube Shorts"].map(p => (
                <button key={p}
                  className={`plat-pick-btn ${form.platforms.includes(p) ? "selected" : ""}`}
                  onClick={() => togglePlatform(p)}>
                  {PLAT_ICONS[p]} {p}
                </button>
              ))}
            </div>

            <label>পোস্টের সময়</label>
            <input type="datetime-local" value={form.scheduled_time}
              onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />

            <label>পুনরাবৃত্তি</label>
            <select value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))}>
              <option value="once">একবার</option>
              <option value="daily">প্রতিদিন</option>
              <option value="weekly">প্রতি সপ্তাহ</option>
            </select>

            <label>শিরোনাম (YouTube এর জন্য)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ flex: 1 }} placeholder="ভিডিওর শিরোনাম" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <button type="button" className="btn-ghost sm" onClick={handleGenerateTitle} disabled={genTitle}>
                {genTitle ? "⏳" : "✨ AI Title"}
              </button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              ফাঁকা রাখলে পোস্ট হওয়ার সময় AI নিজে থেকেই SEO title বানিয়ে নেবে (ফুল-অটো)
            </p>

            <label>ক্যাপশন</label>
            <textarea rows={3} placeholder="পোস্টের ক্যাপশন..." value={form.caption}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>বাতিল</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? "⏳ তৈরি হচ্ছে..." : "📅 শিডিউল করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
