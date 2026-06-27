const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'autopost_token'

export const getToken    = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken    = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
export const getUserInfo = () => { try { return JSON.parse(localStorage.getItem('autopost_user') || '{}') } catch { return {} } }
export const setUserInfo = (u) => u ? localStorage.setItem('autopost_user', JSON.stringify(u)) : localStorage.removeItem('autopost_user')

async function req(path, opts = {}) {
  const token = getToken()
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  })
  if (res.status === 401) {
    setToken(''); setUserInfo(null)
    window.dispatchEvent(new Event('autopost-unauthorized'))
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function upload(path, file, fieldName = 'file') {
  const token = getToken()
  const fd = new FormData(); fd.append(fieldName, file)
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
  return res.json()
}

// ── Health ──────────────────────────────────────────
export const healthCheck = () => req('/health')

// ── Auth ────────────────────────────────────────────
export const login = async (username, password) => {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (data.success) { setToken(data.token); setUserInfo({ username: data.username, role: data.role, user_id: data.user_id }) }
  return data
}
export const googleLogin = async (credential) => {
  const res = await fetch(BASE + '/auth/google', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  const data = await res.json()
  if (data.success) { setToken(data.token); setUserInfo({ username: data.username, role: data.role, user_id: data.user_id, picture: data.picture }) }
  return data
}
export const verifyToken = () => req('/auth/verify')
export const getMe       = () => req('/auth/me')
export const logout      = () => { setToken(''); setUserInfo(null) }

// ── Admin — User Management ──────────────────────────
export const adminGetUsers    = ()       => req('/admin/users')
export const adminCreateUser  = (data)   => req('/admin/users', { method:'POST', body:JSON.stringify(data) })
export const adminUpdateUser  = (id, d)  => req(`/admin/users/${id}`, { method:'PATCH', body:JSON.stringify(d) })
export const adminDeleteUser  = (id)     => req(`/admin/users/${id}`, { method:'DELETE' })
export const adminAddCredits  = (user_id, amount) => req('/admin/credits/add', { method:'POST', body:JSON.stringify({ user_id, amount }) })

// ── Credits ─────────────────────────────────────────
export const getCredits = () => req('/credits')

// ── Profiles ────────────────────────────────────────
export const getProfiles   = ()     => req('/profiles')
export const addProfile    = (d)    => req('/profiles', { method:'POST', body:JSON.stringify(d) })
export const deleteProfile = (id)   => req(`/profiles/${id}`, { method:'DELETE' })
export const fbOAuthStartUrl = (pid) => `${BASE}/fb/oauth/start/${pid}?token=${encodeURIComponent(getToken())}`

// ── Accounts ────────────────────────────────────────
export const getAccounts   = ()     => req('/accounts')
export const addAccount    = (d)    => req('/accounts', { method:'POST', body:JSON.stringify(d) })
export const deleteAccount = (id)   => req(`/accounts/${id}`, { method:'DELETE' })
export const testAccount   = (id)   => req(`/accounts/${id}/test`, { method:'POST' })
export const syncAllAccounts = ()   => req('/accounts/sync-all', { method:'POST' })

// ── Pages Table ─────────────────────────────────────
export const getPagesTable = () => req('/pages')

// ── Schedules ───────────────────────────────────────
export const getSchedules    = ()    => req('/schedules')
export const createSchedule  = (d)   => req('/schedules', { method:'POST', body:JSON.stringify(d) })
export const deleteSchedule  = (id)  => req(`/schedules/${id}`, { method:'DELETE' })

// ── Posts / Stats ────────────────────────────────────
export const getPosts = () => req('/posts')
export const getStats = () => req('/stats')

// ── Workflows ───────────────────────────────────────
export const getWorkflows      = ()     => req('/workflows')
export const saveWorkflow      = (d)    => req('/workflows', { method:'POST', body:JSON.stringify(d) })
export const deleteWorkflow    = (id)   => req(`/workflows/${id}`, { method:'DELETE' })
export const toggleWorkflow    = (id)   => req(`/workflows/${id}/toggle`, { method:'POST' })
export const runWorkflowNow    = (id)   => req(`/workflows/${id}/run-now`, { method:'POST' })
export const runAllWorkflows   = ()     => req('/workflows/run-all-enabled', { method:'POST' })
export const bulkToggleWorkflows = (ids, active) => req('/workflows/bulk-toggle', { method:'POST', body:JSON.stringify({ ids, active }) })

// ── User Drive Key (per-user) ────────────────────────
export const getUserDriveStatus = ()     => req('/user/drive-key')
export const uploadUserDriveKey = (file) => upload('/user/drive-key', file)
export const getUserDriveFiles  = (folder_id) => req('/user/drive/files', { method:'POST', body:JSON.stringify({ folder_id }) })

// ── User Settings ────────────────────────────────────
export const getUserSettings  = ()     => req('/user/settings')
export const saveUserSettings = (d)    => req('/user/settings', { method:'POST', body:JSON.stringify(d) })

// ── Admin Global Settings ────────────────────────────
export const getSettings  = ()     => req('/settings')
export const saveSettings = (d)    => req('/settings', { method:'POST', body:JSON.stringify(d) })
export const setAutoSync  = (e)    => req('/settings/auto-sync', { method:'POST', body:JSON.stringify({ enabled: e }) })
export const getDriveStatus   = ()     => req('/drive/status')
export const uploadDriveKey   = (file) => upload('/upload/drive-key', file)
export const uploadBannerFile = async (file) => {
  const data = await upload('/upload/banner', file)
  if (data.success && data.url?.startsWith('/')) {
    data.url = BASE.replace(/\/api\/?$/, '') + data.url
  }
  return data
}

// ── AI ──────────────────────────────────────────────
export const generateCaptionAI = (d) => req('/ai/caption', { method:'POST', body:JSON.stringify(d) })
export const generateSeoAI     = (d) => req('/ai/seo',     { method:'POST', body:JSON.stringify(d) })

// ── Scraper ─────────────────────────────────────────
export const scrapeTiktokProfile  = (d) => req('/scrape/tiktok-profile',   { method:'POST', body:JSON.stringify(d) })
export const scrapeYoutubeChannel = (d) => req('/scrape/youtube-channel', { method:'POST', body:JSON.stringify(d) })
export const scrapeDownload       = (url) => req('/scrape/download',       { method:'POST', body:JSON.stringify({ url }) })

// ── Contact ──────────────────────────────────────────
export const sendContact = (d) => fetch(BASE+'/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) }).then(r=>r.json())

// ── Login Banner ─────────────────────────────────────
export const getLoginBanner = () => fetch(BASE+'/login-banner').then(r=>r.json())

// ── Backup ───────────────────────────────────────────
export const exportBackup = () => req('/backup/export')
export const importBackup = (d) => req('/backup/import', { method:'POST', body:JSON.stringify(d) })
