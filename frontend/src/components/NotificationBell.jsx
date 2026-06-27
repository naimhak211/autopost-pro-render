import { useState, useEffect, useRef } from "react";

const BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

export default function NotificationBell() {
  const [notifs, setNotifs]   = useState([]);
  const [unread, setUnread]   = useState(0);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef();

  const load = async () => {
    try {
      const res  = await fetch(BASE + "/notifications", { headers: { Authorization: "Bearer " + getToken() } });
      const data = await res.json();
      setNotifs(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {}
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    await fetch(BASE + "/notifications/read-all", { method: "POST", headers: { Authorization: "Bearer " + getToken() } });
    load();
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "8px 12px", cursor: "pointer", position: "relative", fontSize: 18,
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2, background: "#ef4444",
            color: "#fff", borderRadius: "50%", fontSize: 10, fontWeight: 700,
            width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, maxHeight: 420,
          background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 1000, overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>🔔 Notifications</p>
            {unread > 0 && <button onClick={markAll} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>সব পড়া হয়েছে</button>}
          </div>

          <div style={{ overflowY: "auto", maxHeight: 360 }}>
            {notifs.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)", padding: 24, fontSize: 13 }}>কোনো notification নেই</p>
            ) : notifs.map(n => (
              <div key={n.id} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                background: n.is_read ? "transparent" : "var(--accent)11",
              }}>
                {n.title && <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{n.title}</p>}
                <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{n.message}</p>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{n.created_at?.slice(0,16)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
