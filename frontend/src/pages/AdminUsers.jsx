import { useState, useEffect } from "react";
import { adminGetUsers, adminCreateUser, adminUpdateUser, adminAddCredits } from "../api.js";

const BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const EMPTY = { username:"", password:"", email:"", role:"user", credits:0 };

export default function AdminUsers() {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [creditModal, setCreditModal] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [msgModal, setMsgModal]     = useState(null); // null | "all" | user obj
  const [msgForm, setMsgForm]       = useState({ title:"", message:"" });
  const [msgSending, setMsgSending] = useState(false);

  const load = () => adminGetUsers().then(setUsers).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(load, []);

  const openCreate = () => { setForm(EMPTY); setEditUser(null); setShowModal(true); };
  const openEdit   = (u) => { setForm({ username:u.username, password:"", email:u.email||"", role:u.role, credits:u.credits }); setEditUser(u); setShowModal(true); };

  const handleSave = async () => {
    if (!form.username) return alert("Username দিন");
    if (!editUser && !form.password) return alert("Password দিন");
    setSaving(true);
    try {
      if (editUser) {
        const patch = { role:form.role, email:form.email, credits:Number(form.credits) };
        if (form.password) patch.password = form.password;
        await adminUpdateUser(editUser.id, patch);
      } else {
        await adminCreateUser(form);
      }
      setShowModal(false); load();
    } catch { alert("Save ব্যর্থ"); }
    setSaving(false);
  };

  const handleToggleActive = async (u) => {
    await adminUpdateUser(u.id, { is_active: u.is_active ? 0 : 1 }).catch(()=>{});
    load();
  };

  const handleAddCredits = async () => {
    const n = parseInt(creditAmount);
    if (!n || n < 1) return alert("Valid amount দিন");
    await adminAddCredits(creditModal.id, n).catch(()=>{});
    setCreditModal(null); setCreditAmount(""); load();
  };

  const handleSendMsg = async () => {
    if (!msgForm.message.trim()) return alert("Message লিখুন");
    setMsgSending(true);
    try {
      const body = { title: msgForm.title, message: msgForm.message };
      if (msgModal !== "all") body.user_id = msgModal.id;
      const res = await fetch(BASE + "/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { alert("✅ Message পাঠানো হয়েছে!"); setMsgModal(null); setMsgForm({ title:"", message:"" }); }
      else alert("❌ " + (data.error || "ব্যর্থ"));
    } catch { alert("❌ Server error"); }
    setMsgSending(false);
  };

  const up = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>👥 User Management</h1><p className="subtitle">সব user-এর account ও credits পরিচালনা করুন</p></div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn-ghost" onClick={()=>{ setMsgModal("all"); setMsgForm({title:"",message:""}); }}>
            📢 Broadcast
          </button>
          <button className="btn-primary" onClick={openCreate}>+ নতুন User</button>
        </div>
      </div>

      {loading ? <div className="empty-state"><div className="pulse-ring"/></div> :
       users.length === 0 ? <div className="empty-state"><p>কোনো user নেই</p></div> : (
        <div className="pages-table-wrap">
          <table className="pages-table">
            <thead>
              <tr><th>USER</th><th>EMAIL</th><th>ROLE</th><th>CREDITS</th><th>STATUS</th><th>CREATED</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><div className="page-cell">
                    <span className="page-avatar" style={{background: u.role==="admin"?"var(--accent)22":"var(--bg3)"}}>
                      {u.google_picture
                        ? <img src={u.google_picture} style={{width:28,height:28,borderRadius:"50%"}} alt="" />
                        : u.role==="admin"?"👑":"👤"}
                    </span>
                    <p className="page-name">{u.username}</p>
                  </div></td>
                  <td style={{fontSize:12,color:"var(--muted)"}}>{u.email||"—"}</td>
                  <td><span className={u.role==="admin"?"status-ok":"muted"} style={{fontSize:12,fontWeight:600}}>{u.role}</span></td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:700,color:"var(--accent)"}}>{u.credits}</span>
                      <button className="btn-ghost sm" onClick={()=>setCreditModal(u)}>+</button>
                    </div>
                  </td>
                  <td><span className={u.is_active?"status-ok":"status-err"} style={{fontSize:11}}>{u.is_active?"🟢 Active":"🔴 Inactive"}</span></td>
                  <td style={{fontSize:11,color:"var(--muted)"}}>{u.created_at?.slice(0,10)||"—"}</td>
                  <td>
                    <div style={{display:"flex",gap:4}}>
                      <button className="btn-ghost sm" title="Message পাঠান"
                        onClick={()=>{ setMsgModal(u); setMsgForm({title:"",message:""}); }}>✉️</button>
                      <button className="btn-ghost sm" onClick={()=>openEdit(u)}>✏️</button>
                      <button className="btn-ghost sm" onClick={()=>handleToggleActive(u)}>
                        {u.is_active?"⏸":"▶"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{editUser?"User Edit":"নতুন User"}</h2>
            <label>Username</label>
            <input placeholder="username" value={form.username} onChange={e=>up("username",e.target.value)} disabled={!!editUser}/>
            <label>Password {editUser&&<span className="muted" style={{fontSize:11}}>(ফাঁকা রাখলে পুরনো থাকবে)</span>}</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e=>up("password",e.target.value)}/>
            <label>Email</label>
            <input type="email" placeholder="email@example.com" value={form.email} onChange={e=>up("email",e.target.value)}/>
            <label>Role</label>
            <select value={form.role} onChange={e=>up("role",e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <label>Starting Credits</label>
            <input type="number" min="0" value={form.credits} onChange={e=>up("credits",e.target.value)}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?"⏳...":"💾 Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {creditModal && (
        <div className="modal-overlay" onClick={()=>setCreditModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>💎 Credits যোগ করুন — {creditModal.username}</h2>
            <p className="muted" style={{fontSize:13,marginBottom:14}}>বর্তমান: <b>{creditModal.credits}</b> credits</p>
            <label>Add Amount</label>
            <input type="number" min="1" placeholder="100" value={creditAmount} onChange={e=>setCreditAmount(e.target.value)} autoFocus/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setCreditModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddCredits}>💎 Add Credits</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {msgModal && (
        <div className="modal-overlay" onClick={()=>setMsgModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2>{msgModal==="all" ? "📢 সব User-কে Broadcast" : `✉️ Message → ${msgModal.username}`}</h2>
            <label>Title (optional)</label>
            <input placeholder="যেমন: নতুন আপডেট!" value={msgForm.title} onChange={e=>setMsgForm(f=>({...f,title:e.target.value}))}/>
            <label>Message *</label>
            <textarea placeholder="আপনার message লিখুন..." rows={4}
              value={msgForm.message} onChange={e=>setMsgForm(f=>({...f,message:e.target.value}))}
              style={{width:"100%",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",color:"var(--text)",resize:"vertical"}}/>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setMsgModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSendMsg} disabled={msgSending}>
                {msgSending?"⏳ পাঠাচ্ছি...":"✉️ পাঠান"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
