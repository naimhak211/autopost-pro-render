import { useState, useEffect } from "react";
import { getMe, getUserSettings, saveUserSettings, getUserDriveStatus, uploadUserDriveKey } from "../api.js";

export default function UserProfile() {
  const [me, setMe]           = useState(null);
  const [form, setForm]       = useState({ email:"", password:"", password2:"" });
  const [driveStatus, setDS]  = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const up = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    getMe().then(u=>{ setMe(u); setForm(f=>({...f, email:u.email||""})); }).catch(()=>{});
    getUserDriveStatus().then(setDS).catch(()=>{});
  },[]);

  const handleSave = async () => {
    if (form.password && form.password !== form.password2) return alert("Password দুটো মিলছে না");
    setSaving(true);
    try {
      const payload = { email: form.email };
      if (form.password) payload.password = form.password;
      await saveUserSettings(payload);
      setSaved(true); setTimeout(()=>setSaved(false), 2500);
      setForm(f=>({...f, password:"", password2:""}));
    } catch { alert("Save ব্যর্থ"); }
    setSaving(false);
  };

  const handleDriveUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const r = await uploadUserDriveKey(file);
      if (r.success) { setDS({ configured:true, email:r.email }); alert("✅ Drive Key আপলোড হয়েছে"); }
      else alert(r.error || "আপলোড ব্যর্থ");
    } catch { alert("আপলোড ব্যর্থ"); }
    setUploading(false); e.target.value="";
  };

  return (
    <div className="page" style={{maxWidth:600}}>
      <div className="page-header">
        <div><h1>👤 My Profile</h1><p className="subtitle">আপনার account settings ও Google Drive</p></div>
      </div>

      {/* Info card */}
      {me && (
        <div className="card" style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"var(--accent)22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>
            {me.role==="admin"?"👑":"👤"}
          </div>
          <div>
            <p style={{fontWeight:700,fontSize:16}}>{me.username}</p>
            <p className="muted" style={{fontSize:13}}>{me.role} · {me.email||"No email"}</p>
          </div>
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <p style={{fontSize:28,fontWeight:800,color:"var(--accent)"}}>{me.credits}</p>
            <p className="muted" style={{fontSize:12}}>Credits</p>
          </div>
        </div>
      )}

      {/* Account settings */}
      <div className="card">
        <h3>✏️ Account Settings</h3>
        <label>Email</label>
        <input type="email" placeholder="email@example.com" value={form.email} onChange={e=>up("email",e.target.value)}/>
        <label>নতুন Password</label>
        <input type="password" placeholder="ফাঁকা রাখলে পুরনো থাকবে" value={form.password} onChange={e=>up("password",e.target.value)}/>
        {form.password && (
          <>
            <label>Confirm Password</label>
            <input type="password" placeholder="আবার দিন" value={form.password2} onChange={e=>up("password2",e.target.value)}/>
          </>
        )}
        <button className="btn-primary" style={{marginTop:16}} onClick={handleSave} disabled={saving}>
          {saved?"✅ Saved!":saving?"⏳...":"💾 Save"}
        </button>
      </div>

      {/* Google Drive */}
      <div className="card">
        <h3>📁 My Google Drive Key</h3>
        <p className="card-desc">আপনার নিজের Service Account JSON — Workflow-এ Drive ফোল্ডার সোর্স হিসেবে ব্যবহার করার জন্য</p>

        <div className="drive-status-bar">
          <span className={driveStatus?.configured?"status-ok":"status-warn"}>
            {driveStatus===null?"checking...":driveStatus.configured?"✅ Configured":"⚠ Not configured"}
          </span>
          {driveStatus?.email&&<span className="muted" style={{fontSize:12}}>{driveStatus.email}</span>}
          <label className="btn-outline sm" style={{cursor:"pointer",marginLeft:"auto"}}>
            {uploading?"⏳ Uploading...":"⬆ Upload JSON"}
            <input type="file" accept=".json" style={{display:"none"}} onChange={handleDriveUpload} disabled={uploading}/>
          </label>
        </div>

        <details style={{marginTop:14}}>
          <summary className="guide-toggle">▸ Drive key ও folder share কীভাবে করবেন</summary>
          <ol style={{fontSize:12,lineHeight:1.9,paddingLeft:18,marginTop:10,color:"var(--muted)"}}>
            <li>console.cloud.google.com → New Project</li>
            <li>Google Drive API enable করুন</li>
            <li>IAM → Service Accounts → Create → JSON key ডাউনলোড করুন</li>
            <li>JSON থেকে <b>client_email</b> কপি করুন</li>
            <li>Drive ফোল্ডারে → Share → সেই email → <b>Editor</b> access দিন</li>
            <li>JSON ফাইলটা এখানে Upload করুন → Workflow-এ folder link বসান</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
