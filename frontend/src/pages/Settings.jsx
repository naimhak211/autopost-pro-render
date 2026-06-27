import { useState, useEffect } from "react";
import { uploadBannerFile, uploadDriveKey, getDriveStatus, getSettings, saveSettings, setAutoSync, exportBackup, importBackup } from "../api.js";

const API = import.meta.env.VITE_API_URL || "/api";

export default function Settings() {
  const [form, setForm] = useState({
    telegram_bot_token:"", telegram_chat_id:"",
    default_caption:"", notify_success:true, notify_fail:true,
    auto_retry:true, timezone:"Asia/Dhaka",
    login_banner_url:"", login_contract_text:"",
    contact_telegram:"", contact_whatsapp:"", contact_messenger:"",
    admin_username:"", admin_password:"",
    backend_public_url:"", frontend_url:"",
  });
  const [saved,setSaved]                   = useState(false);
  const [tested,setTested]                 = useState(null);
  const [loading,setLoading]               = useState(true);
  const [uploading,setUploading]           = useState(false);
  const [driveStatus,setDriveStatus]       = useState(null);
  const [driveUploading,setDriveUploading] = useState(false);
  const [autoSyncEnabled,setAutoSyncEnabled] = useState(false);
  const [exporting,setExporting]           = useState(false);
  const [importing,setImporting]           = useState(false);

  const up = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    getSettings()
      .then(data=>{ setForm(f=>({...f,...data})); setAutoSyncEnabled(data.auto_sync==="1"); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
    getDriveStatus().then(setDriveStatus).catch(()=>{});
  },[]);

  const save = async () => {
    try { await saveSettings(form); setSaved(true); setTimeout(()=>setSaved(false),2500); }
    catch { alert("সেভ ব্যর্থ"); }
  };

  const testConn = async () => {
    try { const r=await fetch(API+"/health"); const d=await r.json(); setTested(d.status==="ok"?"✅ Connected!":"❌ Failed"); }
    catch { setTested("❌ Backend পাওয়া যাচ্ছে না"); }
  };
  const testTg = async () => {
    try {
      const r=await fetch(`https://api.telegram.org/bot${form.telegram_bot_token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:form.telegram_chat_id,text:"✅ AutoPost Pro test message!"})});
      const d=await r.json(); alert(d.ok?"✅ Telegram মেসেজ পাঠানো হয়েছে!":"❌ "+(d.description||"ব্যর্থ"));
    } catch { alert("❌ Telegram test ব্যর্থ"); }
  };

  const handleBannerUpload = async (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    setUploading(true);
    try { const r=await uploadBannerFile(file); if(r.success) up("login_banner_url",r.url); else alert(r.error||"আপলোড ব্যর্থ"); }
    catch { alert("আপলোড ব্যর্থ"); }
    setUploading(false); e.target.value="";
  };

  const handleDriveUpload = async (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    setDriveUploading(true);
    try { const r=await uploadDriveKey(file); if(r.success){setDriveStatus({configured:true,email:r.email});alert("✅ Drive Key আপলোড হয়েছে");}else alert(r.error||"ব্যর্থ"); }
    catch { alert("আপলোড ব্যর্থ"); }
    setDriveUploading(false); e.target.value="";
  };

  const handleAutoSync = async () => { const n=!autoSyncEnabled; setAutoSyncEnabled(n); await setAutoSync(n).catch(()=>setAutoSyncEnabled(!n)); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data=await exportBackup();
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download=`autopost_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
    } catch { alert("Export ব্যর্থ"); }
    setExporting(false);
  };

  const handleImport = async (e) => {
    const file=e.target.files?.[0]; if(!file) return;
    if(!confirm("এই backup import করলে বিদ্যমান ডেটা replace হবে। নিশ্চিত?")){ e.target.value=""; return; }
    setImporting(true);
    try {
      const data=JSON.parse(await file.text());
      const r=await importBackup(data); alert(r.success?"✅ Import সফল — পেজ Reload করুন":("❌ "+r.error));
    } catch(err){ alert("❌ "+err.message); }
    setImporting(false); e.target.value="";
  };

  if(loading) return <div className="page"><div className="empty-state"><div className="pulse-ring"/></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>⚙️ Settings</h1><p className="subtitle">Connect Google Drive, manage backups, and read the setup guides.</p></div>
        <button className="btn-primary" onClick={save}>{saved?"✅ Saved!":"💾 Save Settings"}</button>
      </div>

      {/* Backend */}
      <div className="card">
        <h3>🌐 Backend Connection</h3>
        <div style={{display:"flex",gap:10}}>
          <input style={{flex:1}} placeholder="https://your-app.up.railway.app/api" value={form.backend_public_url||API} onChange={e=>up("backend_public_url",e.target.value)}/>
          <button className="btn-outline" onClick={testConn}>Test</button>
        </div>
        {tested&&<p style={{fontSize:12,marginTop:8,color:tested.startsWith("✅")?"var(--accent2)":"var(--danger)"}}>{tested}</p>}
        <label style={{marginTop:14}}>Frontend URL (Netlify — FB OAuth-এর জন্য)</label>
        <input placeholder="https://your-app.netlify.app" value={form.frontend_url} onChange={e=>up("frontend_url",e.target.value)}/>
      </div>

      {/* Google Drive */}
      <div className="card">
        <h3>📁 Google Drive Key</h3>
        <p className="card-desc">The service-account JSON used to read your video folders.</p>
        <div className="drive-status-bar">
          <span className={driveStatus?.configured?"status-ok":"status-warn"}>
            {driveStatus===null?"checking...":driveStatus.configured?"✅ Configured":"⚠ Not configured"}
          </span>
          {driveStatus?.email&&<span className="muted" style={{fontSize:12}}>{driveStatus.email}</span>}
          <label className="btn-outline sm" style={{cursor:"pointer",marginLeft:"auto"}}>
            {driveUploading?"⏳ Uploading...":"⬆ Upload JSON"}
            <input type="file" accept=".json" style={{display:"none"}} onChange={handleDriveUpload} disabled={driveUploading}/>
          </label>
        </div>
        <details style={{marginTop:14}}>
          <summary className="guide-toggle">▸ How to create the Drive key &amp; share a folder</summary>
          <ol style={{fontSize:12,lineHeight:1.9,paddingLeft:18,marginTop:10,color:"var(--muted)"}}>
            <li><b>Create a Google Cloud project</b> — console.cloud.google.com → New Project</li>
            <li><b>Enable the Drive API</b> — search "Google Drive API" → Enable</li>
            <li><b>Create a Service Account</b> — IAM → Credentials → Create Credentials → Service account</li>
            <li><b>Make a JSON key</b> — click the account → Keys → Add Key → JSON → download</li>
            <li><b>Copy its email</b> — open the JSON, copy <code>client_email</code></li>
            <li><b>Share each video folder</b> — Drive → right-click folder → Share → paste email → set role to <b>Editor</b></li>
            <li>Upload the JSON file above → paste folder link in a workflow</li>
          </ol>
          <p className="tip-box" style={{fontSize:11,marginTop:8}}>⚠ Must be <b>Editor</b> — the app moves posted videos into a 'success' sub-folder.</p>
        </details>
      </div>

      {/* Facebook App Guide */}
      <div className="card">
        <h3>🛡️ Facebook App ID &amp; Secret</h3>
        <p className="card-desc">Each profile uses its own Facebook app. You set the ID &amp; Secret when adding a profile.</p>
        <details>
          <summary className="guide-toggle">▸ How to create a Facebook App (get App ID &amp; Secret)</summary>
          <ol style={{fontSize:12,lineHeight:1.9,paddingLeft:18,marginTop:10,color:"var(--muted)"}}>
            <li><b>Open Meta for Developers</b> — developers.facebook.com/apps</li>
            <li><b>Create App</b> → Other → Business → Next → name + email → Create App</li>
            <li><b>Add Facebook Login for Business</b> → Set up</li>
            <li><b>Add redirect URI</b> — Facebook Login → Settings → Valid OAuth Redirect URIs:<br/>
              <code>{(form.backend_public_url||"https://your-backend.up.railway.app")+"/api/fb/callback"}</code></li>
            <li><b>Add Privacy &amp; Terms URLs</b> — App settings → Basic:<br/>
              Privacy: <code>{(form.frontend_url||"https://your-app.netlify.app")+"/privacy"}</code><br/>
              Terms: <code>{(form.frontend_url||"https://your-app.netlify.app")+"/terms"}</code></li>
            <li><b>Copy App ID &amp; Secret</b> — App settings → Basic</li>
            <li>Pages &amp; Accounts → + Add Account → paste App ID &amp; Secret → Save → Login with Facebook</li>
            <li>App Review → Permissions: add <code>pages_show_list, pages_read_engagement, pages_manage_posts, business_management</code></li>
          </ol>
          <p className="tip-box" style={{fontSize:11,marginTop:8}}>💡 Keep in <b>Development</b> mode for your own pages — no Facebook review needed.</p>
        </details>
      </div>

      {/* Backup */}
      <div className="card">
        <h3>💾 Backup</h3>
        <p className="card-desc">Export all your data to a file, or restore it on any PC.</p>
        <div style={{display:"flex",gap:12}}>
          <button className="btn-outline" onClick={handleExport} disabled={exporting} style={{flex:1}}>
            {exporting?"⏳...":"⬇ Export Data"}
          </button>
          <label className="btn-outline" style={{flex:1,cursor:"pointer",textAlign:"center"}}>
            {importing?"⏳ Importing...":"⬆ Import Data"}
            <input type="file" accept=".json" style={{display:"none"}} onChange={handleImport} disabled={importing}/>
          </label>
        </div>
        <p className="muted" style={{fontSize:11,marginTop:10}}>Export = one JSON with your profiles, App IDs/Secrets, pages, schedules &amp; Drive key. Keep it private (it contains access tokens).</p>
      </div>

      {/* Auto-sync */}
      <div className="card">
        <h3>🔄 Auto-sync Facebook data</h3>
        <p className="card-desc">Automatically pull page updates (new pages, photos, followers, video counts) from Facebook.</p>
        <div className="toggle-row">
          <label>✅ Status</label>
          <div className={`toggle ${autoSyncEnabled?"on":""}`} onClick={handleAutoSync}/>
        </div>
        <p className="muted" style={{fontSize:11,marginTop:8}}>
          <span style={{color:autoSyncEnabled?"var(--accent2)":"var(--muted)"}}>
            {autoSyncEnabled?"✅ Configured":"○ Not Configured"}
          </span>
        </p>
      </div>

      {/* Telegram */}
      <div className="card">
        <h3>📱 Telegram Notification</h3>
        <label>Bot Token</label>
        <input placeholder="1234567890:ABCdef..." value={form.telegram_bot_token} onChange={e=>up("telegram_bot_token",e.target.value)}/>
        <label>Chat ID</label>
        <div style={{display:"flex",gap:10}}>
          <input style={{flex:1}} placeholder="-100123456789" value={form.telegram_chat_id} onChange={e=>up("telegram_chat_id",e.target.value)}/>
          <button className="btn-outline" onClick={testTg}>Test</button>
        </div>
        <div className="toggle-row" style={{marginTop:14}}>
          <label>সফল পোস্টে নোটিফিকেশন</label>
          <div className={`toggle ${form.notify_success?"on":""}`} onClick={()=>up("notify_success",!form.notify_success)}/>
        </div>
        <div className="toggle-row">
          <label>ব্যর্থ পোস্টে নোটিফিকেশন</label>
          <div className={`toggle ${form.notify_fail?"on":""}`} onClick={()=>up("notify_fail",!form.notify_fail)}/>
        </div>
      </div>

      {/* Login Page Branding */}
      <div className="card">
        <h3>🖼️ Login Page Branding</h3>
        <label>Banner Image URL</label>
        <input placeholder="https://example.com/banner.jpg" value={form.login_banner_url} onChange={e=>up("login_banner_url",e.target.value)}/>
        <label className="btn-outline sm" style={{cursor:"pointer",marginTop:8,display:"inline-block"}}>
          {uploading?"⏳ Uploading...":"📤 ফাইল আপলোড করুন"}
          <input type="file" accept="image/*" style={{display:"none"}} onChange={handleBannerUpload} disabled={uploading}/>
        </label>
        {form.login_banner_url&&<img src={form.login_banner_url} alt="preview" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:10,marginTop:12,border:"1px solid var(--border)"}}/>}
        <label style={{marginTop:14}}>Contract / Details Text</label>
        <textarea rows={2} value={form.login_contract_text} onChange={e=>up("login_contract_text",e.target.value)} placeholder="শর্তাবলী বা contact details..."/>
        <label style={{marginTop:14}}>Contact — Telegram</label>
        <input placeholder="@username বা +8801XXXXXXXX" value={form.contact_telegram} onChange={e=>up("contact_telegram",e.target.value)}/>
        <label>Contact — WhatsApp</label>
        <input placeholder="+8801XXXXXXXXX" value={form.contact_whatsapp} onChange={e=>up("contact_whatsapp",e.target.value)}/>
        <label>Contact — Messenger</label>
        <input placeholder="@page_username" value={form.contact_messenger} onChange={e=>up("contact_messenger",e.target.value)}/>
      </div>

      {/* Admin */}
      <div className="card">
        <h3>🔑 Admin Login</h3>
        <label>Username</label>
        <input placeholder="admin" value={form.admin_username} onChange={e=>up("admin_username",e.target.value)}/>
        <label>নতুন Password</label>
        <input type="password" placeholder="ফাঁকা রাখলে পুরনো থাকবে" value={form.admin_password} onChange={e=>up("admin_password",e.target.value)}/>
      </div>

      {/* General */}
      <div className="card">
        <h3>🌐 General</h3>
        <label>Timezone</label>
        <select value={form.timezone} onChange={e=>up("timezone",e.target.value)}>
          <option value="Asia/Dhaka">Asia/Dhaka (Bangladesh) ⭐</option>
          <option value="Asia/Kolkata">Asia/Kolkata</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/London">Europe/London</option>
        </select>
        <label>Default Caption</label>
        <input placeholder="AutoPost Pro দ্বারা প্রকাশিত 🚀" value={form.default_caption} onChange={e=>up("default_caption",e.target.value)}/>
        <div className="toggle-row" style={{marginTop:14}}>
          <label>Auto-retry failed posts</label>
          <div className={`toggle ${form.auto_retry?"on":""}`} onClick={()=>up("auto_retry",!form.auto_retry)}/>
        </div>
      </div>

      <div style={{textAlign:"right",marginTop:8}}>
        <button className="btn-primary" onClick={save} style={{minWidth:180}}>{saved?"✅ Saved!":"💾 Save All Settings"}</button>
      </div>
    </div>
  );
}
