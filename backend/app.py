from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from dotenv import load_dotenv
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from zoneinfo import ZoneInfo
import os, json, requests, sqlite3, logging, time, urllib.parse

from google_auth import verify_google_token
from notifications import register_notification_routes
from platforms import (
    facebook_post_video, facebook_post_video_file, facebook_get_pages, facebook_get_page_followers,
    instagram_post_reel, tiktok_post_video, youtube_upload_short,
)
from scraper import download_tiktok, download_youtube, scrape_tiktok_profile, scrape_youtube_channel
from drive import list_videos, get_public_url, move_to_success, get_drive_service_for_user
from ai import generate_caption, generate_seo

load_dotenv()
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

DB = "autopost.db"
scheduler = BackgroundScheduler(timezone="Asia/Dhaka")
scheduler.start()

UPLOAD_DIR = os.path.join(app.static_folder or "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp", "gif"}

serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", "dev-secret-change-me"))
TOKEN_MAX_AGE = 7 * 24 * 3600

# ════════════════════════════════════════════════
# DATABASE
# ════════════════════════════════════════════════
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    db = get_db()
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        drive_key_json TEXT,
        credits INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        google_id TEXT,
        google_picture TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        name TEXT,
        type TEXT,
        token TEXT NOT NULL,
        page_id TEXT,
        ig_user_id TEXT,
        status TEXT DEFAULT 'connected',
        profile_id INTEGER,
        followers INTEGER DEFAULT 0,
        growth_pct REAL DEFAULT 0,
        last_synced_at TEXT,
        total_posts INTEGER DEFAULT 0,
        failed_posts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        app_id TEXT,
        app_secret TEXT,
        access_token TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_name TEXT,
        drive_url TEXT,
        local_path TEXT,
        platforms TEXT,
        caption TEXT,
        title TEXT,
        scheduled_time TEXT,
        repeat_mode TEXT DEFAULT 'once',
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        schedule_id INTEGER,
        platform TEXT,
        status TEXT,
        post_url TEXT,
        error TEXT,
        posted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_value TEXT NOT NULL,
        success_folder_id TEXT,
        videos_per_run INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        repeat_mode TEXT DEFAULT 'everyday',
        days_of_week TEXT DEFAULT '[]',
        timezone TEXT DEFAULT 'Asia/Dhaka',
        times TEXT DEFAULT '[]',
        last_run_marker TEXT,
        status TEXT DEFAULT 'not_configured',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflow_posted_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL,
        source_item_id TEXT NOT NULL,
        posted_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS account_stats_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        followers INTEGER,
        recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scraped_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        source_platform TEXT, source_url TEXT,
        title TEXT, local_path TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    # Seed default admin from env
    admin_u = os.getenv("ADMIN_USERNAME", "admin")
    admin_p = os.getenv("ADMIN_PASSWORD", "admin123")
    existing = db.execute("SELECT id FROM users WHERE username=?", (admin_u,)).fetchone()
    if not existing:
        db.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?,?,?)",
            (admin_u, generate_password_hash(admin_p), "admin")
        )
    db.execute("INSERT OR IGNORE INTO settings (key,value) VALUES ('credits','0')")
    db.commit()

init_db()

# ════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════
def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None
        if not token:
            return jsonify({"success": False, "error": "Login প্রয়োজন"}), 401
        try:
            payload = serializer.loads(token, max_age=TOKEN_MAX_AGE)
        except SignatureExpired:
            return jsonify({"success": False, "error": "Session মেয়াদ শেষ"}), 401
        except BadSignature:
            return jsonify({"success": False, "error": "অবৈধ session"}), 401
        user = get_db().execute("SELECT * FROM users WHERE id=? AND is_active=1", (payload["uid"],)).fetchone()
        if not user:
            return jsonify({"success": False, "error": "User পাওয়া যায়নি"}), 401
        request.current_user = dict(user)
        return f(*args, **kwargs)
    return wrapper

def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else None
        if not token:
            return jsonify({"success": False, "error": "Login প্রয়োজন"}), 401
        try:
            payload = serializer.loads(token, max_age=TOKEN_MAX_AGE)
        except (SignatureExpired, BadSignature):
            return jsonify({"success": False, "error": "অবৈধ session"}), 401
        user = get_db().execute("SELECT * FROM users WHERE id=? AND is_active=1", (payload["uid"],)).fetchone()
        if not user or user["role"] != "admin":
            return jsonify({"success": False, "error": "Admin access প্রয়োজন"}), 403
        request.current_user = dict(user)
        return f(*args, **kwargs)
    return wrapper

def uid():
    return request.current_user["id"]

def is_admin():
    return request.current_user.get("role") == "admin"

# ════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════
def get_setting(key, default=""):
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else os.getenv(key.upper(), default)

def send_telegram(msg):
    token = get_setting("telegram_bot_token")
    chat_id = get_setting("telegram_chat_id")
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"},
            timeout=10
        )
    except Exception as e:
        logging.warning(f"Telegram error: {e}")

DOW_MAP = {0:"MO",1:"TU",2:"WE",3:"TH",4:"FR",5:"SA",6:"SU"}

# ════════════════════════════════════════════════
# ACCOUNT SYNC & WORKFLOW ENGINE
# ════════════════════════════════════════════════
def _sync_all_accounts():
    db = get_db()
    accs = db.execute("SELECT * FROM accounts WHERE platform='Facebook'").fetchall()
    synced = 0
    for a in accs:
        if not a["page_id"]: continue
        followers = facebook_get_page_followers(a["token"], a["page_id"])
        if followers is None: continue
        prev = db.execute(
            "SELECT followers FROM account_stats_history WHERE account_id=? ORDER BY recorded_at DESC LIMIT 1",
            (a["id"],)
        ).fetchone()
        growth = 0.0
        if prev and prev["followers"]:
            growth = round(((followers - prev["followers"]) / prev["followers"]) * 100, 2)
        db.execute("INSERT INTO account_stats_history (account_id, followers) VALUES (?,?)", (a["id"], followers))
        db.execute("UPDATE accounts SET followers=?, growth_pct=?, last_synced_at=? WHERE id=?",
                   (followers, growth, datetime.utcnow().isoformat(), a["id"]))
        synced += 1
    db.commit()
    return synced

def _record_workflow_post(db, w, acc, source_item_id, caption, ok, msg):
    db.execute("INSERT INTO workflow_posted_items (workflow_id, source_item_id) VALUES (?,?)", (w["id"], source_item_id))
    db.execute(
        "INSERT INTO posts (user_id, schedule_id, platform, status, post_url, error) VALUES (?,?,?,?,?,?)",
        (w["user_id"], None, acc["platform"], "success" if ok else "failed", msg if ok else None, None if ok else msg)
    )
    if ok:
        db.execute("UPDATE accounts SET total_posts = total_posts + 1 WHERE id=?", (acc["id"],))
        db.execute("UPDATE users SET credits = MAX(0, credits - 1) WHERE id=?", (w["user_id"],))
    else:
        db.execute("UPDATE accounts SET failed_posts = failed_posts + 1 WHERE id=?", (acc["id"],))
    db.commit()
    send_telegram(f"{'✅' if ok else '❌'} Workflow — {acc['name']}: {caption}")

def execute_workflow(workflow_id):
    db = get_db()
    w = db.execute("SELECT * FROM workflows WHERE id=?", (workflow_id,)).fetchone()
    if not w: return
    acc = db.execute("SELECT * FROM accounts WHERE id=?", (w["account_id"],)).fetchone()
    if not acc: return
    user = db.execute("SELECT * FROM users WHERE id=?", (w["user_id"],)).fetchone()
    if not user: return

    n = w["videos_per_run"] or 1
    posted_ids = {r["source_item_id"] for r in db.execute(
        "SELECT source_item_id FROM workflow_posted_items WHERE workflow_id=?", (workflow_id,)
    ).fetchall()}

    candidates = []
    if w["source_type"] == "drive":
        try:
            files = list_videos(w["source_value"], user_drive_json=user["drive_key_json"])
            files = list(reversed(files))
            candidates = [f for f in files if f["id"] not in posted_ids][:n]
        except Exception as e:
            logging.error(f"Drive list error for workflow {workflow_id}: {e}")
            return
    elif w["source_type"] == "tiktok":
        username = w["source_value"].rstrip("/").split("@")[-1].split("/")[0]
        videos = scrape_tiktok_profile(username, limit=30)
        videos = list(reversed(videos))
        candidates = [v for v in videos if v["id"] not in posted_ids][:n]

    if not candidates:
        db.execute("UPDATE workflows SET active=0, status='not_configured' WHERE id=?", (workflow_id,))
        db.commit()
        send_telegram(f"⚠️ Workflow #{workflow_id} ({acc['name']}): ভিডিও শেষ, auto-paused")
        return

    for item in candidates:
        if w["source_type"] == "drive":
            video_url = item.get("webContentLink") or get_public_url(item["id"])
            title = os.path.splitext(item["name"])[0]
            ok, msg = facebook_post_video(acc["token"], acc["page_id"], title, video_url)
            _record_workflow_post(db, w, acc, item["id"], title, ok, msg)
            if ok and w["success_folder_id"]:
                move_to_success(item["id"], w["success_folder_id"], user_drive_json=user["drive_key_json"])
        else:
            dl_ok, path = download_tiktok(item["url"])
            title = (item.get("title") or "Video")[:80]
            if not dl_ok:
                _record_workflow_post(db, w, acc, item["id"], title, False, f"Download failed: {path}")
                continue
            ok, msg = facebook_post_video_file(acc["token"], acc["page_id"], title, path)
            _record_workflow_post(db, w, acc, item["id"], title, ok, msg)

    db.execute("UPDATE workflows SET status='active' WHERE id=?", (workflow_id,))
    db.commit()

def run_workflow_engine():
    db = get_db()
    rows = db.execute("SELECT * FROM workflows WHERE active=1").fetchall()
    for w in rows:
        try:
            tz = ZoneInfo(w["timezone"] or "Asia/Dhaka")
        except Exception:
            tz = ZoneInfo("Asia/Dhaka")
        local_now = datetime.now(tz)
        current_hm = local_now.strftime("%H:%M")
        times = json.loads(w["times"] or "[]")
        if current_hm not in times: continue
        if w["repeat_mode"] == "specific_days":
            days = json.loads(w["days_of_week"] or "[]")
            if DOW_MAP[local_now.weekday()] not in days: continue
        marker = f"{local_now.strftime('%Y-%m-%d')} {current_hm}"
        if w["last_run_marker"] == marker: continue
        db.execute("UPDATE workflows SET last_run_marker=? WHERE id=?", (marker, w["id"]))
        db.commit()
        try:
            execute_workflow(w["id"])
        except Exception as e:
            logging.error(f"Workflow {w['id']} run error: {e}")

scheduler.add_job(run_workflow_engine, "interval", minutes=1, id="workflow_engine", replace_existing=True)
scheduler.add_job(_sync_all_accounts, "interval", hours=6, id="account_sync", replace_existing=True)

# ════════════════════════════════════════════════
# SCHEDULE JOB RUNNER
# ════════════════════════════════════════════════
def run_post_job(schedule_id):
    db = get_db()
    row = db.execute("SELECT * FROM schedules WHERE id=?", (schedule_id,)).fetchone()
    if not row: return
    user = db.execute("SELECT * FROM users WHERE id=?", (row["user_id"],)).fetchone()
    platforms = json.loads(row["platforms"] or "[]")
    caption = row["caption"] or get_setting("default_caption", "AutoPost Pro দ্বারা প্রকাশিত 🚀")
    title = row["title"] or caption[:80]
    if not row["title"]:
        seo_platform = "YouTube" if any(p in ("YouTube","YouTube Shorts") for p in platforms) else (platforms[0] if platforms else "Facebook")
        seo = generate_seo(caption or row["file_name"] or "video", platform=seo_platform)
        if seo and seo.get("seo_title"):
            title = seo["seo_title"]
            db.execute("UPDATE schedules SET title=? WHERE id=?", (title, schedule_id))
    video_url = row["drive_url"] or ""
    local_path = row["local_path"] or ""
    results = []
    for platform in platforms:
        acc = db.execute(
            "SELECT * FROM accounts WHERE user_id=? AND platform=? AND status='connected' LIMIT 1",
            (row["user_id"], platform)
        ).fetchone()
        ok, msg = False, "No connected account"
        if acc:
            if platform == "Facebook":
                if acc["page_id"] and acc["token"] and video_url:
                    ok, msg = facebook_post_video(acc["token"], acc["page_id"], caption, video_url)
                elif acc["page_id"] and acc["token"] and local_path and os.path.exists(local_path):
                    ok, msg = facebook_post_video_file(acc["token"], acc["page_id"], caption, local_path)
                else:
                    ok, msg = False, "Missing Page ID, token or video"
            elif platform == "Instagram":
                ok, msg = instagram_post_reel(acc["token"], acc["ig_user_id"], caption, video_url)
            elif platform == "TikTok":
                ok, msg = tiktok_post_video(acc["token"], caption, local_path or video_url)
            elif platform in ("YouTube", "YouTube Shorts"):
                ok, msg = youtube_upload_short(acc["token"], title, caption, local_path or video_url)
        db.execute(
            "INSERT INTO posts (user_id, schedule_id, platform, status, post_url, error) VALUES (?,?,?,?,?,?)",
            (row["user_id"], schedule_id, platform, "success" if ok else "failed", msg if ok else None, None if ok else msg)
        )
        if ok:
            db.execute("UPDATE accounts SET total_posts = total_posts + 1 WHERE id=?", (acc["id"],))
            db.execute("UPDATE users SET credits = MAX(0, credits - 1) WHERE id=?", (row["user_id"],))
        else:
            if acc:
                db.execute("UPDATE accounts SET failed_posts = failed_posts + 1 WHERE id=?", (acc["id"],))
        results.append(f"{'✅' if ok else '❌'} {platform}: {msg}")
    db.execute("UPDATE schedules SET status='done' WHERE id=?", (schedule_id,))
    db.commit()
    send_telegram(f"<b>AutoPost Pro</b>\n" + "\n".join(results))


# ════════════════════════════════════════════════
# GOOGLE OAUTH
# ════════════════════════════════════════════════
@app.route("/api/auth/google", methods=["POST"])
def auth_google():
    d = request.json or {}
    token = d.get("credential") or d.get("token")
    if not token:
        return jsonify({"success": False, "error": "Google token পাওয়া যায়নি"}), 400

    info = verify_google_token(token)
    if not info:
        return jsonify({"success": False, "error": "Google verification ব্যর্থ হয়েছে"}), 401

    db = get_db()
    # Check if google_id already exists
    user = db.execute("SELECT * FROM users WHERE google_id=? AND is_active=1", (info["google_id"],)).fetchone()

    if not user:
        # Check by email
        user = db.execute("SELECT * FROM users WHERE email=? AND is_active=1", (info["email"],)).fetchone()
        if user:
            # Link Google account to existing user
            db.execute("UPDATE users SET google_id=?, google_picture=? WHERE id=?",
                       (info["google_id"], info["picture"], user["id"]))
            db.commit()
            user = db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        else:
            # New user — auto register with Google
            username = info["email"].split("@")[0]
            # Make username unique
            base = username
            i = 1
            while db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone():
                username = f"{base}{i}"; i += 1
            cur = db.execute(
                "INSERT INTO users (username, password_hash, email, role, credits, google_id, google_picture) VALUES (?,?,?,?,?,?,?)",
                (username, generate_password_hash(os.urandom(16).hex()), info["email"], "user", 0, info["google_id"], info["picture"])
            )
            db.commit()
            user = db.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()

    token_str = serializer.dumps({"uid": user["id"]})
    return jsonify({
        "success": True, "token": token_str,
        "username": user["username"], "role": user["role"],
        "user_id": user["id"], "picture": info["picture"],
    })

# ════════════════════════════════════════════════
# AUTH ROUTES
# ════════════════════════════════════════════════
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    d = request.json or {}
    username = d.get("username", "").strip()
    password = d.get("password", "")
    user = get_db().execute("SELECT * FROM users WHERE username=? AND is_active=1", (username,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "ভুল Username বা Password"}), 401
    token = serializer.dumps({"uid": user["id"]})
    return jsonify({
        "success": True, "token": token,
        "username": user["username"], "role": user["role"], "user_id": user["id"]
    })

@app.route("/api/auth/verify")
@auth_required
def auth_verify():
    u = request.current_user
    return jsonify({"success": True, "username": u["username"], "role": u["role"], "user_id": u["id"]})

@app.route("/api/auth/me")
@auth_required
def auth_me():
    u = request.current_user
    return jsonify({
        "id": u["id"], "username": u["username"], "email": u["email"],
        "role": u["role"], "credits": u["credits"],
        "drive_configured": bool(u.get("drive_key_json"))
    })

# ════════════════════════════════════════════════
# ADMIN — USER MANAGEMENT
# ════════════════════════════════════════════════
@app.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_get_users():
    rows = get_db().execute(
        "SELECT id, username, email, role, credits, is_active, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/admin/users", methods=["POST"])
@admin_required
def admin_create_user():
    d = request.json or {}
    if not d.get("username") or not d.get("password"):
        return jsonify({"success": False, "error": "Username ও Password প্রয়োজন"}), 400
    db = get_db()
    if db.execute("SELECT id FROM users WHERE username=?", (d["username"],)).fetchone():
        return jsonify({"success": False, "error": "Username ইতিমধ্যে আছে"}), 400
    db.execute(
        "INSERT INTO users (username, password_hash, email, role, credits) VALUES (?,?,?,?,?)",
        (d["username"], generate_password_hash(d["password"]), d.get("email",""), d.get("role","user"), int(d.get("credits",0)))
    )
    db.commit()
    return jsonify({"success": True})

@app.route("/api/admin/users/<int:user_id>", methods=["PATCH"])
@admin_required
def admin_update_user(user_id):
    d = request.json or {}
    db = get_db()
    if "password" in d and d["password"]:
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(d["password"]), user_id))
    if "role" in d:
        db.execute("UPDATE users SET role=? WHERE id=?", (d["role"], user_id))
    if "credits" in d:
        db.execute("UPDATE users SET credits=? WHERE id=?", (int(d["credits"]), user_id))
    if "is_active" in d:
        db.execute("UPDATE users SET is_active=? WHERE id=?", (1 if d["is_active"] else 0, user_id))
    if "email" in d:
        db.execute("UPDATE users SET email=? WHERE id=?", (d["email"], user_id))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@admin_required
def admin_delete_user(user_id):
    if user_id == uid():
        return jsonify({"success": False, "error": "নিজেকে delete করা যাবে না"}), 400
    db = get_db()
    db.execute("UPDATE users SET is_active=0 WHERE id=?", (user_id,))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/admin/credits/add", methods=["POST"])
@admin_required
def admin_add_credits():
    d = request.json or {}
    user_id_target = d.get("user_id")
    amount = int(d.get("amount", 0))
    if not user_id_target or amount < 1:
        return jsonify({"success": False, "error": "user_id ও amount প্রয়োজন"}), 400
    db = get_db()
    db.execute("UPDATE users SET credits = credits + ? WHERE id=?", (amount, user_id_target))
    db.commit()
    row = db.execute("SELECT credits FROM users WHERE id=?", (user_id_target,)).fetchone()
    return jsonify({"success": True, "credits": row["credits"] if row else 0})

# ════════════════════════════════════════════════
# CREDITS (current user)
# ════════════════════════════════════════════════
@app.route("/api/credits")
@auth_required
def get_credits():
    u = get_db().execute("SELECT credits FROM users WHERE id=?", (uid(),)).fetchone()
    return jsonify({"credits": u["credits"] if u else 0})

# ════════════════════════════════════════════════
# PROFILES (per-user FB App)
# ════════════════════════════════════════════════
@app.route("/api/profiles", methods=["GET"])
@auth_required
def get_profiles():
    rows = get_db().execute("SELECT id,name,app_id,access_token,created_at FROM profiles WHERE user_id=? ORDER BY created_at DESC", (uid(),)).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["connected"] = bool(d.pop("access_token"))
        result.append(d)
    return jsonify(result)

@app.route("/api/profiles", methods=["POST"])
@auth_required
def add_profile():
    d = request.json or {}
    if not d.get("name") or not d.get("app_id") or not d.get("app_secret"):
        return jsonify({"success": False, "error": "Name, App ID ও Secret প্রয়োজন"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO profiles (user_id,name,app_id,app_secret) VALUES (?,?,?,?)",
        (uid(), d["name"], d["app_id"], d["app_secret"])
    )
    db.commit()
    return jsonify({"success": True, "id": cur.lastrowid})

@app.route("/api/profiles/<int:pid>", methods=["DELETE"])
@auth_required
def delete_profile(pid):
    db = get_db()
    db.execute("DELETE FROM profiles WHERE id=? AND user_id=?", (pid, uid()))
    db.commit()
    return jsonify({"success": True})

# ════════════════════════════════════════════════
# FACEBOOK OAUTH
# ════════════════════════════════════════════════
@app.route("/api/fb/oauth/start/<int:pid>")
def fb_oauth_start(pid):
    token = request.args.get("token", "")
    try:
        payload = serializer.loads(token, max_age=TOKEN_MAX_AGE)
        user_id = payload["uid"]
    except (BadSignature, SignatureExpired):
        return "Unauthorized", 401
    profile = get_db().execute("SELECT * FROM profiles WHERE id=? AND user_id=?", (pid, user_id)).fetchone()
    if not profile:
        return "Profile পাওয়া যায়নি", 404
    backend_url = get_setting("backend_public_url", os.getenv("BACKEND_PUBLIC_URL", request.host_url.rstrip("/")))
    redirect_uri = f"{backend_url}/api/fb/callback"
    state = serializer.dumps({"pid": pid, "uid": user_id})
    params = {
        "client_id": profile["app_id"],
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "pages_show_list,pages_read_engagement,pages_manage_posts,business_management",
    }
    return redirect("https://www.facebook.com/v19.0/dialog/oauth?" + urllib.parse.urlencode(params))

@app.route("/api/fb/callback")
def fb_callback():
    frontend_url = get_setting("frontend_url", os.getenv("FRONTEND_URL", "/"))
    code = request.args.get("code")
    state = request.args.get("state")
    if request.args.get("error") or not code or not state:
        return redirect(f"{frontend_url}?fb_connect=failed")
    try:
        data = serializer.loads(state, max_age=600)
        pid, user_id = data["pid"], data["uid"]
    except Exception:
        return redirect(f"{frontend_url}?fb_connect=failed")
    db = get_db()
    profile = db.execute("SELECT * FROM profiles WHERE id=? AND user_id=?", (pid, user_id)).fetchone()
    if not profile:
        return redirect(f"{frontend_url}?fb_connect=failed")
    backend_url = get_setting("backend_public_url", os.getenv("BACKEND_PUBLIC_URL", request.host_url.rstrip("/")))
    redirect_uri = f"{backend_url}/api/fb/callback"
    try:
        tok = requests.get("https://graph.facebook.com/v19.0/oauth/access_token", params={
            "client_id": profile["app_id"], "client_secret": profile["app_secret"],
            "redirect_uri": redirect_uri, "code": code,
        }, timeout=20).json()
        short_token = tok.get("access_token")
        if not short_token:
            return redirect(f"{frontend_url}?fb_connect=failed")
        long_tok = requests.get("https://graph.facebook.com/v19.0/oauth/access_token", params={
            "grant_type": "fb_exchange_token", "client_id": profile["app_id"],
            "client_secret": profile["app_secret"], "fb_exchange_token": short_token,
        }, timeout=20).json()
        long_token = long_tok.get("access_token", short_token)
        db.execute("UPDATE profiles SET access_token=? WHERE id=?", (long_token, pid))
        pages = facebook_get_pages(long_token)
        for p in pages:
            existing = db.execute("SELECT id FROM accounts WHERE user_id=? AND platform='Facebook' AND page_id=?", (user_id, p.get("id"))).fetchone()
            if existing:
                db.execute("UPDATE accounts SET token=?, name=?, status='connected', profile_id=? WHERE id=?",
                           (p.get("access_token"), p.get("name"), pid, existing["id"]))
            else:
                db.execute(
                    "INSERT INTO accounts (user_id,platform,name,type,token,page_id,status,profile_id) VALUES (?,?,?,?,?,?,?,?)",
                    (user_id, "Facebook", p.get("name"), "Page", p.get("access_token"), p.get("id"), "connected", pid)
                )
        db.commit()
        return redirect(f"{frontend_url}?fb_connect=success&pages={len(pages)}")
    except Exception as e:
        logging.error(f"FB OAuth callback error: {e}")
        return redirect(f"{frontend_url}?fb_connect=failed")

# ════════════════════════════════════════════════
# ACCOUNTS
# ════════════════════════════════════════════════
@app.route("/api/accounts", methods=["GET"])
@auth_required
def get_accounts():
    rows = get_db().execute(
        "SELECT id,platform,name,type,page_id,ig_user_id,status,created_at,profile_id,followers,growth_pct,last_synced_at,total_posts,failed_posts FROM accounts WHERE user_id=?",
        (uid(),)
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/accounts", methods=["POST"])
@auth_required
def add_account():
    d = request.json or {}
    db = get_db()
    db.execute(
        "INSERT INTO accounts (user_id,platform,name,type,token,page_id,ig_user_id) VALUES (?,?,?,?,?,?,?)",
        (uid(), d["platform"], d.get("name",""), d.get("type",""), d["token"], d.get("page_id",""), d.get("ig_user_id",""))
    )
    db.commit()
    return jsonify({"success": True})

@app.route("/api/accounts/<int:acc_id>", methods=["DELETE"])
@auth_required
def delete_account(acc_id):
    db = get_db()
    db.execute("DELETE FROM accounts WHERE id=? AND user_id=?", (acc_id, uid()))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/accounts/<int:acc_id>/test", methods=["POST"])
@auth_required
def test_account(acc_id):
    acc = get_db().execute("SELECT * FROM accounts WHERE id=? AND user_id=?", (acc_id, uid())).fetchone()
    if not acc:
        return jsonify({"success": False, "error": "Account পাওয়া যায়নি"}), 404
    pages = facebook_get_pages(acc["token"])
    return jsonify({"success": bool(pages), "pages": pages})

@app.route("/api/accounts/sync-all", methods=["POST"])
@auth_required
def sync_accounts():
    db = get_db()
    accs = db.execute("SELECT * FROM accounts WHERE user_id=? AND platform='Facebook'", (uid(),)).fetchall()
    synced = 0
    for a in accs:
        if not a["page_id"]: continue
        followers = facebook_get_page_followers(a["token"], a["page_id"])
        if followers is None: continue
        prev = db.execute("SELECT followers FROM account_stats_history WHERE account_id=? ORDER BY recorded_at DESC LIMIT 1", (a["id"],)).fetchone()
        growth = round(((followers - prev["followers"]) / prev["followers"]) * 100, 2) if prev and prev["followers"] else 0.0
        db.execute("INSERT INTO account_stats_history (account_id, followers) VALUES (?,?)", (a["id"], followers))
        db.execute("UPDATE accounts SET followers=?, growth_pct=?, last_synced_at=? WHERE id=?",
                   (followers, growth, datetime.utcnow().isoformat(), a["id"]))
        synced += 1
    db.commit()
    return jsonify({"success": True, "synced": synced})

# ════════════════════════════════════════════════
# PAGES TABLE
# ════════════════════════════════════════════════
@app.route("/api/pages")
@auth_required
def get_pages_table():
    db = get_db()
    accs = db.execute("SELECT * FROM accounts WHERE user_id=? ORDER BY name", (uid(),)).fetchall()
    result = []
    for a in accs:
        d = dict(a)
        wf = db.execute("SELECT times,timezone,active FROM workflows WHERE user_id=? AND account_id=? AND active=1 ORDER BY id LIMIT 1", (uid(), a["id"])).fetchone()
        d["next_post"] = None
        d["workflow_status"] = "not_configured"
        if wf:
            times = json.loads(wf["times"] or "[]")
            try:
                tz = ZoneInfo(wf["timezone"] or "Asia/Dhaka")
                now = datetime.now(tz)
                for t in sorted(times):
                    h, m = map(int, t.split(":"))
                    candidate = now.replace(hour=h, minute=m, second=0, microsecond=0)
                    if candidate > now:
                        d["next_post"] = candidate.strftime("%H:%M")
                        break
            except Exception:
                pass
            d["workflow_status"] = "active"
        result.append(d)
    return jsonify(result)

# ════════════════════════════════════════════════
# SCHEDULES
# ════════════════════════════════════════════════
@app.route("/api/schedules", methods=["GET"])
@auth_required
def get_schedules():
    rows = get_db().execute("SELECT * FROM schedules WHERE user_id=? ORDER BY scheduled_time DESC", (uid(),)).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        try: d["platforms"] = json.loads(d["platforms"] or "[]")
        except: d["platforms"] = []
        result.append(d)
    return jsonify(result)

@app.route("/api/schedules", methods=["POST"])
@auth_required
def create_schedule():
    d = request.json or {}
    db = get_db()
    cur = db.execute(
        "INSERT INTO schedules (user_id,file_name,drive_url,platforms,caption,title,scheduled_time,repeat_mode) VALUES (?,?,?,?,?,?,?,?)",
        (uid(), d.get("file_name",""), d.get("drive_url",""), json.dumps(d.get("platforms",[])),
         d.get("caption",""), d.get("title",""), d.get("scheduled_time"), d.get("repeat_mode","once"))
    )
    sch_id = cur.lastrowid
    db.commit()
    try:
        run_dt = datetime.fromisoformat(d["scheduled_time"])
        scheduler.add_job(run_post_job, "date", run_date=run_dt, args=[sch_id], id=f"post_{sch_id}", replace_existing=True)
    except Exception as e:
        logging.warning(f"Schedule job add failed: {e}")
    return jsonify({"success": True, "id": sch_id})

@app.route("/api/schedules/<int:sch_id>", methods=["DELETE"])
@auth_required
def delete_schedule(sch_id):
    db = get_db()
    db.execute("DELETE FROM schedules WHERE id=? AND user_id=?", (sch_id, uid()))
    db.commit()
    try: scheduler.remove_job(f"post_{sch_id}")
    except: pass
    return jsonify({"success": True})

# ════════════════════════════════════════════════
# POSTS / STATS / ACTIVITY
# ════════════════════════════════════════════════
@app.route("/api/posts")
@auth_required
def get_posts():
    rows = get_db().execute(
        "SELECT p.*, s.file_name, s.caption, s.scheduled_time FROM posts p LEFT JOIN schedules s ON p.schedule_id=s.id WHERE p.user_id=? ORDER BY p.posted_at DESC LIMIT 100",
        (uid(),)
    ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/stats")
@auth_required
def get_stats():
    db = get_db()
    u = uid()
    total   = db.execute("SELECT COUNT(*) FROM posts WHERE user_id=?", (u,)).fetchone()[0]
    success = db.execute("SELECT COUNT(*) FROM posts WHERE user_id=? AND status='success'", (u,)).fetchone()[0]
    failed  = db.execute("SELECT COUNT(*) FROM posts WHERE user_id=? AND status='failed'", (u,)).fetchone()[0]
    pending = db.execute("SELECT COUNT(*) FROM schedules WHERE user_id=? AND status='pending'", (u,)).fetchone()[0]
    accs    = db.execute("SELECT COUNT(*) FROM accounts WHERE user_id=? AND status='connected'", (u,)).fetchone()[0]
    profiles = db.execute("SELECT COUNT(*) FROM profiles WHERE user_id=?", (u,)).fetchone()[0]
    pages_synced = db.execute("SELECT COUNT(*) FROM accounts WHERE user_id=? AND last_synced_at IS NOT NULL", (u,)).fetchone()[0]
    wf_active  = db.execute("SELECT COUNT(*) FROM workflows WHERE user_id=? AND status='active'", (u,)).fetchone()[0]
    wf_paused  = db.execute("SELECT COUNT(*) FROM workflows WHERE user_id=? AND status='paused'", (u,)).fetchone()[0]
    credits = db.execute("SELECT credits FROM users WHERE id=?", (u,)).fetchone()
    return jsonify({
        "total_posts": total, "success": success, "failed": failed,
        "pending_schedules": pending, "connected_accounts": accs,
        "success_rate": round((success/total*100) if total else 0, 1),
        "profiles_connected": profiles, "pages_synced": pages_synced,
        "workflows_active": wf_active, "workflows_paused": wf_paused,
        "credits": credits["credits"] if credits else 0,
    })

# ════════════════════════════════════════════════
# WORKFLOWS
# ════════════════════════════════════════════════
def _serialize_workflow(r):
    d = dict(r)
    d["days_of_week"] = json.loads(d["days_of_week"] or "[]")
    d["times"] = json.loads(d["times"] or "[]")
    d["active"] = bool(d["active"])
    return d

@app.route("/api/workflows", methods=["GET"])
@auth_required
def get_workflows():
    rows = get_db().execute(
        "SELECT w.*, a.name as account_name, a.platform as account_platform FROM workflows w LEFT JOIN accounts a ON w.account_id=a.id WHERE w.user_id=? ORDER BY w.created_at DESC",
        (uid(),)
    ).fetchall()
    return jsonify([_serialize_workflow(r) for r in rows])

@app.route("/api/workflows", methods=["POST"])
@auth_required
def save_workflow():
    d = request.json or {}
    if not d.get("account_id") or not d.get("source_type") or not d.get("source_value"):
        return jsonify({"success": False, "error": "Page, Source Type ও Source Value প্রয়োজন"}), 400
    # Verify account belongs to this user
    acc = get_db().execute("SELECT id FROM accounts WHERE id=? AND user_id=?", (d["account_id"], uid())).fetchone()
    if not acc:
        return jsonify({"success": False, "error": "অবৈধ account"}), 403
    db = get_db()
    active = 1 if d.get("active") else 0
    status = "active" if active else "paused"
    args = (
        uid(), d["account_id"], d["source_type"], d["source_value"], d.get("success_folder_id",""),
        int(d.get("videos_per_run",1)), active, d.get("repeat_mode","everyday"),
        json.dumps(d.get("days_of_week",[])), d.get("timezone","Asia/Dhaka"),
        json.dumps(d.get("times",[])), status,
    )
    if d.get("id"):
        db.execute("""UPDATE workflows SET user_id=?,account_id=?,source_type=?,source_value=?,success_folder_id=?,
                       videos_per_run=?,active=?,repeat_mode=?,days_of_week=?,timezone=?,times=?,status=? WHERE id=? AND user_id=?""",
                   args + (d["id"], uid()))
        wid = d["id"]
    else:
        cur = db.execute("""INSERT INTO workflows (user_id,account_id,source_type,source_value,success_folder_id,
                             videos_per_run,active,repeat_mode,days_of_week,timezone,times,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", args)
        wid = cur.lastrowid
    db.commit()
    return jsonify({"success": True, "id": wid})

@app.route("/api/workflows/<int:wid>", methods=["DELETE"])
@auth_required
def delete_workflow(wid):
    db = get_db()
    db.execute("DELETE FROM workflows WHERE id=? AND user_id=?", (wid, uid()))
    db.execute("DELETE FROM workflow_posted_items WHERE workflow_id=?", (wid,))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/workflows/<int:wid>/toggle", methods=["POST"])
@auth_required
def toggle_workflow(wid):
    db = get_db()
    w = db.execute("SELECT active FROM workflows WHERE id=? AND user_id=?", (wid, uid())).fetchone()
    if not w: return jsonify({"success": False}), 404
    new_active = 0 if w["active"] else 1
    db.execute("UPDATE workflows SET active=?, status=? WHERE id=?", (new_active, "active" if new_active else "paused", wid))
    db.commit()
    return jsonify({"success": True, "active": bool(new_active)})

@app.route("/api/workflows/<int:wid>/run-now", methods=["POST"])
@auth_required
def run_workflow_now(wid):
    # Verify ownership
    w = get_db().execute("SELECT id FROM workflows WHERE id=? AND user_id=?", (wid, uid())).fetchone()
    if not w: return jsonify({"success": False, "error": "Not found"}), 404
    try: execute_workflow(wid); return jsonify({"success": True})
    except Exception as e: return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/workflows/bulk-toggle", methods=["POST"])
@auth_required
def bulk_toggle_workflows():
    d = request.json or {}
    ids = d.get("ids", [])
    active = 1 if d.get("active") else 0
    status = "active" if active else "paused"
    db = get_db()
    for wid in ids:
        db.execute("UPDATE workflows SET active=?, status=? WHERE id=? AND user_id=?", (active, status, wid, uid()))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/workflows/run-all-enabled", methods=["POST"])
@auth_required
def run_all_workflows():
    rows = get_db().execute("SELECT id FROM workflows WHERE user_id=? AND active=1", (uid(),)).fetchall()
    ran = 0
    for r in rows:
        try: execute_workflow(r["id"]); ran += 1
        except Exception as e: logging.error(f"Workflow {r['id']} run error: {e}")
    return jsonify({"success": True, "ran": ran})

# ════════════════════════════════════════════════
# USER DRIVE KEY (per-user)
# ════════════════════════════════════════════════
@app.route("/api/user/drive-key", methods=["GET"])
@auth_required
def get_user_drive_status():
    u = get_db().execute("SELECT drive_key_json FROM users WHERE id=?", (uid(),)).fetchone()
    if u and u["drive_key_json"]:
        try:
            j = json.loads(u["drive_key_json"])
            return jsonify({"configured": True, "email": j.get("client_email","")})
        except Exception:
            pass
    return jsonify({"configured": False, "email": None})

@app.route("/api/user/drive-key", methods=["POST"])
@auth_required
def upload_user_drive_key():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "ফাইল পাওয়া যায়নি"}), 400
    f = request.files["file"]
    try:
        content = f.read().decode("utf-8")
        j = json.loads(content)
        if "client_email" not in j:
            return jsonify({"success": False, "error": "Valid Service Account JSON নয়"}), 400
        get_db().execute("UPDATE users SET drive_key_json=? WHERE id=?", (content, uid()))
        get_db().commit()
        return jsonify({"success": True, "email": j["client_email"]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/api/user/drive/files", methods=["POST"])
@auth_required
def user_drive_files():
    d = request.json or {}
    u = get_db().execute("SELECT drive_key_json FROM users WHERE id=?", (uid(),)).fetchone()
    if not u or not u["drive_key_json"]:
        return jsonify({"success": False, "error": "Drive key configure করা হয়নি"}), 400
    try:
        files = list_videos(d.get("folder_id",""), user_drive_json=u["drive_key_json"])
        return jsonify({"success": True, "files": files})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ════════════════════════════════════════════════
# USER SETTINGS (per-user)
# ════════════════════════════════════════════════
@app.route("/api/user/settings", methods=["GET"])
@auth_required
def get_user_settings():
    u = get_db().execute("SELECT username, email FROM users WHERE id=?", (uid(),)).fetchone()
    return jsonify({"username": u["username"], "email": u["email"] or ""})

@app.route("/api/user/settings", methods=["POST"])
@auth_required
def save_user_settings():
    d = request.json or {}
    db = get_db()
    if d.get("email") is not None:
        db.execute("UPDATE users SET email=? WHERE id=?", (d["email"], uid()))
    if d.get("password"):
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(d["password"]), uid()))
    db.commit()
    return jsonify({"success": True})

# ════════════════════════════════════════════════
# ADMIN GLOBAL SETTINGS
# ════════════════════════════════════════════════
@app.route("/api/settings", methods=["GET"])
@admin_required
def get_settings_route():
    rows = get_db().execute("SELECT key,value FROM settings").fetchall()
    data = {r["key"]: r["value"] for r in rows}
    data.pop("admin_password", None)
    return jsonify(data)

@app.route("/api/settings", methods=["POST"])
@admin_required
def save_settings():
    db = get_db()
    for k, v in (request.json or {}).items():
        if k in ("admin_password", "admin_username"): continue
        db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, v))
    db.commit()
    return jsonify({"success": True})

@app.route("/api/settings/auto-sync", methods=["POST"])
@admin_required
def toggle_auto_sync():
    enabled = (request.json or {}).get("enabled", False)
    db = get_db()
    db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('auto_sync',?)", ("1" if enabled else "0",))
    db.commit()
    if enabled:
        try: scheduler.add_job(_sync_all_accounts, "interval", hours=6, id="account_sync", replace_existing=True)
        except: pass
    else:
        try: scheduler.remove_job("account_sync")
        except: pass
    return jsonify({"success": True, "enabled": enabled})

# ════════════════════════════════════════════════
# ADMIN DRIVE KEY (global fallback)
# ════════════════════════════════════════════════
@app.route("/api/drive/status")
@admin_required
def drive_status():
    key = get_setting("google_service_account", "")
    if not key: return jsonify({"configured": False, "email": None})
    try:
        j = json.loads(key)
        return jsonify({"configured": True, "email": j.get("client_email","")})
    except: return jsonify({"configured": False, "email": None})

@app.route("/api/upload/drive-key", methods=["POST"])
@admin_required
def upload_drive_key():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "ফাইল পাওয়া যায়নি"}), 400
    f = request.files["file"]
    try:
        content = f.read().decode("utf-8")
        j = json.loads(content)
        if "client_email" not in j:
            return jsonify({"success": False, "error": "Valid Service Account JSON নয়"}), 400
        db = get_db()
        db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('google_service_account',?)", (content,))
        db.commit()
        return jsonify({"success": True, "email": j["client_email"]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

# ════════════════════════════════════════════════
# AI
# ════════════════════════════════════════════════
@app.route("/api/ai/caption", methods=["POST"])
@auth_required
def ai_caption():
    d = request.json or {}
    if not d.get("topic"): return jsonify({"success": False, "error": "topic প্রয়োজন"}), 400
    result = generate_caption(d["topic"], d.get("tone","প্রফেশনাল"), d.get("platform","Instagram"), d.get("lang","বাংলা"))
    if result is None: return jsonify({"success": False, "error": "AI ব্যর্থ হয়েছে"}), 500
    return jsonify({"success": True, **result})

@app.route("/api/ai/seo", methods=["POST"])
@auth_required
def ai_seo():
    d = request.json or {}
    if not d.get("topic"): return jsonify({"success": False, "error": "topic প্রয়োজন"}), 400
    result = generate_seo(d["topic"], d.get("keyword",""), d.get("platform","YouTube"))
    if result is None: return jsonify({"success": False, "error": "AI ব্যর্থ হয়েছে"}), 500
    return jsonify({"success": True, **result})

# ════════════════════════════════════════════════
# SCRAPER
# ════════════════════════════════════════════════
@app.route("/api/scrape/tiktok-profile", methods=["POST"])
@auth_required
def scrape_tiktok():
    d = request.json
    return jsonify({"videos": scrape_tiktok_profile(d.get("username","").lstrip("@"), int(d.get("limit",5)))})

@app.route("/api/scrape/youtube-channel", methods=["POST"])
@auth_required
def scrape_youtube():
    d = request.json
    return jsonify({"videos": scrape_youtube_channel(d.get("url",""), int(d.get("limit",5)))})

@app.route("/api/scrape/download", methods=["POST"])
@auth_required
def dl_video():
    url = request.json.get("url","")
    ok, path = download_tiktok(url) if "tiktok" in url else download_youtube(url)
    return jsonify({"success": ok, "path": path if ok else None, "error": None if ok else path})

# ════════════════════════════════════════════════
# CONTACT
# ════════════════════════════════════════════════
@app.route("/api/contact", methods=["POST"])
def contact_message():
    d = request.json or {}
    if not d.get("message"): return jsonify({"success": False, "error": "Message প্রয়োজন"}), 400
    get_db().execute("INSERT INTO contact_messages (name,email,message) VALUES (?,?,?)",
                     (d.get("name",""), d.get("email",""), d["message"]))
    get_db().commit()
    send_telegram(f"📩 Contact\nName: {d.get('name','')}\nEmail: {d.get('email','')}\n\n{d['message']}")
    return jsonify({"success": True})

# ════════════════════════════════════════════════
# LOGIN BANNER (public)
# ════════════════════════════════════════════════
@app.route("/api/login-banner")
def login_banner():
    return jsonify({
        "banner_url":        get_setting("login_banner_url",""),
        "contract_text":     get_setting("login_contract_text",""),
        "contact_telegram":  get_setting("contact_telegram",""),
        "contact_whatsapp":  get_setting("contact_whatsapp",""),
        "contact_messenger": get_setting("contact_messenger",""),
    })

# ════════════════════════════════════════════════
# BANNER UPLOAD
# ════════════════════════════════════════════════
@app.route("/api/upload/banner", methods=["POST"])
@admin_required
def upload_banner():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "ফাইল পাওয়া যায়নি"}), 400
    f = request.files["file"]
    ext = f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else ""
    if ext not in ALLOWED_IMAGE_EXT:
        return jsonify({"success": False, "error": "শুধু image ফাইল"}), 400
    fname = secure_filename(f"banner_{int(time.time())}.{ext}")
    f.save(os.path.join(UPLOAD_DIR, fname))
    return jsonify({"success": True, "url": f"/static/uploads/{fname}"})

# ════════════════════════════════════════════════
# BACKUP (admin only)
# ════════════════════════════════════════════════
@app.route("/api/backup/export")
@admin_required
def backup_export():
    db = get_db()
    return jsonify({
        "exported_at": datetime.utcnow().isoformat(),
        "users":     [dict(r) for r in db.execute("SELECT id,username,email,role,credits,is_active,created_at FROM users").fetchall()],
        "accounts":  [dict(r) for r in db.execute("SELECT * FROM accounts").fetchall()],
        "profiles":  [dict(r) for r in db.execute("SELECT * FROM profiles").fetchall()],
        "workflows": [dict(r) for r in db.execute("SELECT * FROM workflows").fetchall()],
        "settings":  {r["key"]:r["value"] for r in db.execute("SELECT * FROM settings").fetchall()},
    })

@app.route("/api/backup/import", methods=["POST"])
@admin_required
def backup_import():
    d = request.json or {}
    db = get_db()
    try:
        for u in d.get("users", []):
            db.execute("INSERT OR IGNORE INTO users (id,username,password_hash,email,role,credits,is_active) VALUES (?,?,?,?,?,?,?)",
                       (u.get("id"), u.get("username"), u.get("password_hash",""), u.get("email",""), u.get("role","user"), u.get("credits",0), u.get("is_active",1)))
        for a in d.get("accounts", []):
            db.execute("INSERT OR REPLACE INTO accounts (id,user_id,platform,name,type,token,page_id,ig_user_id,status) VALUES (?,?,?,?,?,?,?,?,?)",
                       (a.get("id"),a.get("user_id"),a.get("platform"),a.get("name"),a.get("type"),a.get("token"),a.get("page_id"),a.get("ig_user_id"),a.get("status","connected")))
        for w in d.get("workflows", []):
            db.execute("INSERT OR REPLACE INTO workflows (id,user_id,account_id,source_type,source_value,success_folder_id,videos_per_run,active,repeat_mode,days_of_week,timezone,times,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       (w.get("id"),w.get("user_id"),w.get("account_id"),w.get("source_type"),w.get("source_value"),w.get("success_folder_id"),w.get("videos_per_run",1),w.get("active",1),w.get("repeat_mode","everyday"),w.get("days_of_week","[]"),w.get("timezone","Asia/Dhaka"),w.get("times","[]"),w.get("status","not_configured")))
        for k,v in d.get("settings",{}).items():
            db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k,v))
        db.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

register_notification_routes(app, get_db, require_auth, require_admin, g, jsonify, request)
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG","false").lower()=="true")
