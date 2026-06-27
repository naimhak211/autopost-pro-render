import { useState, useEffect } from "react";
import { getPagesTable, syncAllAccounts } from "../api.js";

const STATUS_OPTS = ["All", "active", "connected", "error"];
const WF_COLOR = { active: "var(--accent2)", not_configured: "var(--warn)", paused: "var(--warn)" };

export default function Pages() {
  const [pages, setPages]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("All");
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch]   = useState("");

  const load = () => {
    getPagesTable().then(setPages).catch(() => setPages([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSync = async () => {
    setSyncing(true);
    try { await syncAllAccounts(); load(); } catch {}
    setSyncing(false);
  };

  const visible = pages.filter(p => {
    const matchFilter = filter === "All" || p.status === filter || p.workflow_status === filter;
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>📄 Pages</h1><p className="subtitle">সব Facebook Page-এর বিস্তারিত অবস্থা</p></div>
        <button className="btn-outline" onClick={handleSync} disabled={syncing}>
          {syncing ? "⏳..." : "↻ Sync All"}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 পেজ খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: "0 0 200px" }} />
        <span className="muted" style={{ fontSize: 12 }}>Status:</span>
        {STATUS_OPTS.map(s => (
          <button key={s} className={`chip ${filter === s ? "chip-active" : ""}`} onClick={() => setFilter(s)}>
            {s}
          </button>
        ))}
        <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>{visible.length} PAGES FOUND</span>
      </div>

      {loading ? (
        <div className="empty-state"><div className="pulse-ring" /></div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>📄 কোনো পেজ নেই। Profiles পেজ থেকে Facebook Login করুন।</p>
        </div>
      ) : (
        <div className="pages-table-wrap">
          <table className="pages-table">
            <thead>
              <tr>
                <th>PAGE</th>
                <th>FOLLOWERS</th>
                <th>GROWTH</th>
                <th>SCHED</th>
                <th>POSTS</th>
                <th>NEXT POST</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="page-cell">
                      <span className="page-avatar">📘</span>
                      <div>
                        <p className="page-name">{p.name}</p>
                        <p className="page-id muted" style={{ fontSize: 11 }}>{p.page_id || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td>{p.followers?.toLocaleString() || "—"}</td>
                  <td style={{ color: p.growth_pct > 0 ? "var(--accent2)" : p.growth_pct < 0 ? "var(--danger)" : undefined }}>
                    {p.growth_pct != null ? `${p.growth_pct > 0 ? "+" : ""}${p.growth_pct}%` : "—"}
                  </td>
                  <td>
                    <span style={{ color: WF_COLOR[p.workflow_status] || "var(--muted)", fontSize: 12 }}>
                      {p.workflow_status === "active" ? "✅ Active" : p.workflow_status === "paused" ? "⏸ Paused" : "⚙ None"}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--accent2)" }}>{p.total_posts ?? 0}</span>
                    {p.failed_posts > 0 && <span style={{ color: "var(--danger)", marginLeft: 4 }}>/ {p.failed_posts}✗</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{p.next_post || "—"}</td>
                  <td>
                    <span className={p.status === "connected" ? "status-ok" : "status-err"} style={{ fontSize: 11 }}>
                      {p.status === "connected" ? "🟢 Connected" : "🔴 " + p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
