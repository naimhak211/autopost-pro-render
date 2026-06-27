import { useState, useEffect } from "react";
import { getStats, getPosts } from "../api.js";

const COLORS = { Facebook:"#1877F2", Instagram:"#E1306C", TikTok:"#010101", YouTube:"#FF0000", "YouTube Shorts":"#FF0000" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getPosts()])
      .then(([s, p]) => { setStats(s); setPosts(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="empty-state"><div className="pulse-ring" /></div></div>;

  // Posts by platform
  const byPlatform = posts.reduce((acc, p) => { acc[p.platform] = (acc[p.platform] || 0) + 1; return acc; }, {});
  const total = Object.values(byPlatform).reduce((a, b) => a + b, 0) || 1;

  // Posts per month (last 6 months)
  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MONTHS[d.getMonth()], key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, count: 0 };
  });
  posts.forEach(p => {
    const key = (p.posted_at || "").slice(0, 7);
    const b = monthBuckets.find(b => b.key === key);
    if (b) b.count++;
  });
  const maxMonth = Math.max(...monthBuckets.map(b => b.count), 1);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>📈 Analytics</h1><p className="subtitle">Your posting performance at a glance</p></div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label:"Total Posts",    value:stats?.total_posts||0,    icon:"📤", color:"#6C63FF" },
          { label:"Successful",     value:stats?.success||0,        icon:"✅", color:"#00C9A7" },
          { label:"Failed",         value:stats?.failed||0,         icon:"❌", color:"#FF6B6B" },
          { label:"Success Rate",   value:(stats?.success_rate||0)+"%", icon:"📊", color:"#6C63FF" },
          { label:"Accounts",       value:stats?.connected_accounts||0, icon:"🔗", color:"#00C9A7" },
          { label:"Workflows Active",value:stats?.workflows_active||0,  icon:"⚙️", color:"#FFA800" },
        ].map(s => (
          <div className="stat-card" key={s.label} style={{ borderTopColor: s.color }}>
            <div className="stat-icon" style={{ background: s.color + "22" }}>{s.icon}</div>
            <div><p className="stat-value">{s.value}</p><p className="stat-label">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="two-col">
        {/* Monthly bar chart */}
        <div className="card">
          <h3>📅 Posts per Month</h3>
          <div className="bar-chart" style={{ marginTop: 16 }}>
            {monthBuckets.map(b => (
              <div className="bar-col" key={b.key}>
                <span className="bar-val">{b.count || ""}</span>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{ height: `${(b.count/maxMonth)*100}%`, background: "var(--accent)" }} />
                </div>
                <span className="bar-label">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform share */}
        <div className="card">
          <h3>🌐 Platform Distribution</h3>
          {Object.keys(byPlatform).length === 0 ? (
            <p className="muted" style={{ marginTop: 16 }}>কোনো পোস্ট নেই এখনো।</p>
          ) : (
            <div className="platform-share" style={{ marginTop: 16 }}>
              {Object.entries(byPlatform).sort((a,b) => b[1]-a[1]).map(([plat, cnt]) => (
                <div className="share-row" key={plat}>
                  <span className="share-name">{plat}</span>
                  <div className="share-bar-wrap">
                    <div className="share-bar" style={{ width:`${(cnt/total)*100}%`, background: COLORS[plat]||"var(--accent)" }} />
                  </div>
                  <span className="share-pct">{Math.round((cnt/total)*100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent posts table */}
      <div className="card">
        <h3>🕒 Recent Posts</h3>
        {posts.length === 0 ? <p className="muted" style={{ marginTop:12 }}>কোনো পোস্ট নেই।</p> : (
          <div className="pages-table-wrap" style={{ marginTop: 14 }}>
            <table className="pages-table">
              <thead><tr><th>FILE</th><th>PLATFORM</th><th>STATUS</th><th>TIME</th></tr></thead>
              <tbody>
                {posts.slice(0,20).map(p => (
                  <tr key={p.id}>
                    <td style={{ maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.file_name||"—"}</td>
                    <td>{p.platform}</td>
                    <td><span className={p.status==="success"?"status-ok":"status-err"}>{p.status==="success"?"✅ Success":"❌ Failed"}</span></td>
                    <td style={{ fontSize:12, color:"var(--muted)" }}>{p.posted_at?.slice(0,16)||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
