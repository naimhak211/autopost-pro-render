import { useState, useEffect } from "react";
import { getStats, getPosts, getAccounts } from "../api.js";

export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [posts, setPosts]     = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getPosts(), getAccounts()])
      .then(([s, p, a]) => { setStats(s); setPosts(p); setAccounts(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const CARDS = stats ? [
    { label:"Total Posts",       value:stats.total_posts,          icon:"📤", color:"#6C63FF" },
    { label:"Successful",        value:stats.success,              icon:"✅", color:"#00C9A7" },
    { label:"Failed",            value:stats.failed,               icon:"❌", color:"#FF6B6B" },
    { label:"Scheduled",         value:stats.pending_schedules,    icon:"⏳", color:"#FFA800" },
    { label:"Success Rate",      value:stats.success_rate+"%",     icon:"📈", color:"#6C63FF" },
    { label:"Pages Connected",   value:stats.connected_accounts,   icon:"🔗", color:"#00C9A7" },
    { label:"Profiles",          value:stats.profiles_connected,   icon:"🛡️",color:"#6C63FF" },
    { label:"Pages Synced",      value:stats.pages_synced,         icon:"↻",  color:"#00C9A7" },
    { label:"Workflows Active",  value:stats.workflows_active,     icon:"▶",  color:"#00C9A7" },
    { label:"Workflows Paused",  value:stats.workflows_paused,     icon:"⏸", color:"#FFA800" },
  ] : [];

  if (loading) return <div className="page"><div className="empty-state"><div className="pulse-ring" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>📊 Dashboard</h1><p className="subtitle">Welcome back! Here's what's happening.</p></div>
      </div>

      <div className="stats-grid">
        {CARDS.map(c => (
          <div className="stat-card" key={c.label} style={{ borderTopColor: c.color }}>
            <div className="stat-icon" style={{ background: c.color + "22" }}>{c.icon}</div>
            <div><p className="stat-value">{c.value ?? "—"}</p><p className="stat-label">{c.label}</p></div>
          </div>
        ))}
      </div>

      {/* Active accounts with growth */}
      {accounts.filter(a => a.platform === "Facebook").length > 0 && (
        <div className="card">
          <h3>📄 Pages Overview</h3>
          <div className="pages-table-wrap" style={{ marginTop:14 }}>
            <table className="pages-table">
              <thead><tr><th>PAGE</th><th>FOLLOWERS</th><th>GROWTH</th><th>POSTS</th><th>STATUS</th></tr></thead>
              <tbody>
                {accounts.filter(a => a.platform==="Facebook").slice(0,8).map(a => (
                  <tr key={a.id}>
                    <td><div className="page-cell"><span className="page-avatar">📘</span><p className="page-name">{a.name}</p></div></td>
                    <td>{a.followers?.toLocaleString()||"—"}</td>
                    <td style={{color:a.growth_pct>0?"var(--accent2)":a.growth_pct<0?"var(--danger)":undefined}}>
                      {a.growth_pct!=null?`${a.growth_pct>0?"+":""}${a.growth_pct}%`:"—"}
                    </td>
                    <td>{a.total_posts||0}</td>
                    <td><span className={a.status==="connected"?"status-ok":"status-err"} style={{fontSize:12}}>
                      {a.status==="connected"?"🟢 Connected":"🔴 "+a.status}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent posts */}
      <div className="card">
        <h3>🕒 Recent Activity</h3>
        {posts.length === 0 ? (
          <p className="muted" style={{ marginTop:12 }}>কোনো পোস্ট নেই এখনো। Workflow বা Schedule থেকে শুরু করুন।</p>
        ) : (
          <div className="queue-list" style={{ marginTop:12 }}>
            {posts.slice(0, 8).map(p => (
              <div className="queue-item" key={p.id}>
                <div className="queue-file">{p.file_name || "Video"}</div>
                <div className="queue-caption">{p.platform}</div>
                <div className="queue-time">{p.scheduled_time?.slice(0,16)||p.posted_at?.slice(0,16)||"—"}</div>
                <span className={p.status==="success"?"status-ok":"status-err"} style={{fontSize:12}}>
                  {p.status==="success"?"✅ Success":"❌ Failed"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
