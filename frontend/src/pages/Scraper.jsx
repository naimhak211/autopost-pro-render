import { useState } from "react";
import { scrapeTiktokProfile, scrapeYoutubeChannel, scrapeDownload } from "../api.js";

export default function Scraper() {
  const [tab, setTab] = useState("tiktok");
  const [input, setInput] = useState("");
  const [limit, setLimit] = useState(5);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dlStatus, setDlStatus] = useState({});

  const scrape = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setVideos([]);
    try {
      const data = tab === "tiktok"
        ? await scrapeTiktokProfile({ username: input.replace("@", ""), limit })
        : await scrapeYoutubeChannel({ url: input, limit });
      setVideos(data.videos || []);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const download = async (url, id) => {
    setDlStatus(s => ({ ...s, [id]: "downloading" }));
    try {
      const data = await scrapeDownload(url);
      setDlStatus(s => ({ ...s, [id]: data.success ? "done" : "failed" }));
    } catch {
      setDlStatus(s => ({ ...s, [id]: "failed" }));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>📥 ভিডিও স্ক্রেপার</h1>
          <p className="subtitle">TikTok ও YouTube থেকে ভিডিও ডাউনলোড করুন</p>
        </div>
      </div>

      <div className="card">
        <div className="tab-row">
          <button className={`tab-btn ${tab === "tiktok" ? "active" : ""}`} onClick={() => setTab("tiktok")}>🎵 TikTok</button>
          <button className={`tab-btn ${tab === "youtube" ? "active" : ""}`} onClick={() => setTab("youtube")}>▶️ YouTube</button>
        </div>

        <label>{tab === "tiktok" ? "TikTok Username (@mybrand)" : "YouTube Channel URL"}</label>
        <input
          placeholder={tab === "tiktok" ? "@username" : "https://youtube.com/@channel"}
          value={input}
          onChange={e => setInput(e.target.value)}
        />

        <label>ভিডিওর সংখ্যা</label>
        <select value={limit} onChange={e => setLimit(+e.target.value)}>
          {[3, 5, 10, 20].map(n => <option key={n} value={n}>{n}টি</option>)}
        </select>

        <button className="btn-primary mt" onClick={scrape} disabled={loading}>
          {loading ? "⏳ স্ক্যান করছে..." : "🔍 ভিডিও খুঁজুন"}
        </button>
      </div>

      {videos.length > 0 && (
        <div className="card">
          <h3>{videos.length}টি ভিডিও পাওয়া গেছে</h3>
          <div className="scrape-list">
            {videos.map((v, i) => {
              const st = dlStatus[v.id];
              return (
                <div className="scrape-item" key={v.id || i}>
                  <div className="scrape-info">
                    <p className="scrape-title">{v.title || "শিরোনাম নেই"}</p>
                    <p className="scrape-meta">
                      {v.view_count ? `👁️ ${Number(v.view_count).toLocaleString()} views` : ""}
                      {v.duration ? ` · ⏱️ ${v.duration}s` : ""}
                    </p>
                    <a href={v.url} target="_blank" rel="noreferrer" className="scrape-url">{v.url?.slice(0, 55)}...</a>
                  </div>
                  <div className="scrape-actions">
                    <button
                      className={`btn-primary ${st === "done" ? "btn-success" : ""}`}
                      onClick={() => download(v.url, v.id)}
                      disabled={st === "downloading" || st === "done"}
                    >
                      {st === "downloading" ? "⏳" : st === "done" ? "✅ ডাউনলোড হয়েছে" : st === "failed" ? "❌ ব্যর্থ" : "⬇️ ডাউনলোড"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📥</div>
            <p>উপরে username বা URL দিয়ে ভিডিও খুঁজুন</p>
          </div>
        </div>
      )}
    </div>
  );
}
