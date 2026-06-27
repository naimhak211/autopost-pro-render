import { useState, useEffect } from "react";
import { getPosts } from "../api.js";

const PLAT_ICONS = { Facebook: "📘", Instagram: "📸", TikTok: "🎵", YouTube: "▶️", "YouTube Shorts": "▶️" };

export default function Logs() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getPosts()
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>📋 পোস্ট লগ</h1>
          <p className="subtitle">সকল পোস্টের ইতিহাস</p>
        </div>
        <div className="filter-row">
          {["all", "success", "failed"].map(f => (
            <button key={f}
              className={`tab-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}>
              {f === "all" ? "সব" : f === "success" ? "✅ সফল" : "❌ ব্যর্থ"}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><div className="pulse-ring" /><p>লোড হচ্ছে...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div><p>কোনো লগ নেই</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>প্ল্যাটফর্ম</th>
                <th>ফাইল</th>
                <th>অবস্থা</th>
                <th>পোস্ট URL</th>
                <th>সময়</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i}>
                  <td>{PLAT_ICONS[p.platform] || "📤"} {p.platform}</td>
                  <td className="muted">{p.file_name || "—"}</td>
                  <td>
                    {p.status === "success"
                      ? <span className="badge badge-success">✅ সফল</span>
                      : <span className="badge badge-failed" title={p.error}>❌ ব্যর্থ</span>
                    }
                  </td>
                  <td>
                    {p.post_url
                      ? <a href={p.post_url} target="_blank" rel="noreferrer" className="link">দেখুন ↗</a>
                      : <span className="muted">{p.error?.slice(0, 40) || "—"}</span>
                    }
                  </td>
                  <td className="muted">{p.posted_at?.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
