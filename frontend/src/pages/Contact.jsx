import { useState } from "react";
import { sendContact } from "../api.js";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent]   = useState(false);
  const [sending, setSending] = useState(false);
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.message.trim()) return alert("Message লিখুন");
    setSending(true);
    try {
      const res = await sendContact(form);
      if (res.success) { setSent(true); setForm({ name: "", email: "", message: "" }); }
      else alert(res.error || "পাঠানো ব্যর্থ হয়েছে");
    } catch { alert("সার্ভার error"); }
    setSending(false);
  };

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div><h1>✉️ Contact Us</h1><p className="subtitle">আমাদের দলের সাথে সরাসরি যোগাযোগ করুন</p></div>
      </div>

      {sent ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <h3 style={{ marginTop: 16 }}>বার্তা পাঠানো হয়েছে!</h3>
          <p className="muted" style={{ marginTop: 8 }}>আমরা শীঘ্রই যোগাযোগ করব।</p>
          <button className="btn-outline" style={{ marginTop: 20 }} onClick={() => setSent(false)}>আরেকটি বার্তা পাঠান</button>
        </div>
      ) : (
        <div className="card">
          <h3>✉ বার্তা পাঠান</h3>
          <label>আপনার নাম</label>
          <input placeholder="নাম" value={form.name} onChange={e => up("name", e.target.value)} />
          <label>ইমেইল</label>
          <input type="email" placeholder="email@example.com" value={form.email} onChange={e => up("email", e.target.value)} />
          <label>বার্তা</label>
          <textarea rows={5} placeholder="আপনার বার্তা লিখুন..." value={form.message} onChange={e => up("message", e.target.value)} />
          <button className="btn-primary full-width mt" onClick={handle} disabled={sending}>
            {sending ? "⏳ পাঠানো হচ্ছে..." : "📤 Send Message"}
          </button>
        </div>
      )}
    </div>
  );
}
