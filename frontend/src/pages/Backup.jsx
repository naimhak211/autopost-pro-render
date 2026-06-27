import { useState } from "react";
import { exportBackup, importBackup } from "../api.js";

export default function Backup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setMsg("");
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autopost_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✅ Backup ডাউনলোড হয়েছে");
    } catch { setMsg("❌ Export ব্যর্থ হয়েছে"); }
    setExporting(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("এই backup import করলে বিদ্যমান Profiles, Accounts ও Workflows replace হবে। নিশ্চিত?")) {
      e.target.value = ""; return;
    }
    setImporting(true);
    setMsg("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await importBackup(data);
      setMsg(res.success ? "✅ Import সফল হয়েছে — পেজ Reload করুন" : `❌ ${res.error}`);
    } catch (err) { setMsg(`❌ ব্যর্থ: ${err.message}`); }
    setImporting(false);
    e.target.value = "";
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>💾 Backup & Restore</h1>
          <p className="subtitle">সব ডেটা JSON ফাইলে Export/Import করুন</p>
        </div>
      </div>

      {msg && (
        <div className="tip-box" style={{ color: msg.startsWith("✅") ? "var(--accent2)" : "var(--danger)", marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <h3>📤 Export Backup</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.7 }}>
            আপনার সব Profiles, Accounts, Workflows ও Settings একটা JSON ফাইলে ডাউনলোড হবে।
            পাসওয়ার্ড এবং Admin credentials export হবে না।
          </p>
          <button className="btn-primary full-width" onClick={handleExport} disabled={exporting}>
            {exporting ? "⏳ তৈরি হচ্ছে..." : "⬇️ Download Backup"}
          </button>
        </div>

        <div className="card">
          <h3>📥 Import Backup</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.7 }}>
            আগের backup JSON ফাইল দিয়ে সব ডেটা restore করুন।
            বিদ্যমান ডেটা replace হবে।
          </p>
          <label className="btn-outline full-width" style={{ cursor: "pointer", textAlign: "center", display: "block" }}>
            {importing ? "⏳ Import হচ্ছে..." : "⬆️ JSON ফাইল বেছে নিন"}
            <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>📋 Backup-এ কী কী থাকে?</h3>
        <div className="platform-list" style={{ gap: 10 }}>
          {[
            ["🛡️ Profiles", "Facebook App ID, Secret ও Access Token (OAuth token সহ)"],
            ["🔗 Accounts", "সব Facebook Page, Instagram, TikTok, YouTube অ্যাকাউন্ট"],
            ["⚙️ Workflows", "সব Automation workflow — source, schedule, timing সহ"],
            ["⚙️ Settings", "Telegram notification, Default caption, Banner URL — Admin password বাদে"],
          ].map(([icon, desc]) => (
            <div className="platform-row" key={icon}>
              <span>{icon}</span>
              <span style={{ fontSize: 13 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
