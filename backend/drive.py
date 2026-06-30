"""
Google Drive — per-user service account support.
No circular imports: caller passes user_drive_json directly.
"""
import os, json, logging
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']

def _build_service(user_drive_json: str | None = None):
    """
    Build a Drive service.
    Priority: user_drive_json arg → GOOGLE_SERVICE_ACCOUNT_JSON env var.
    """
    raw = user_drive_json or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        raise ValueError("Google Drive key not configured. My Profile → Drive Key upload করুন।")
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build('drive', 'v3', credentials=creds)

def get_drive_service_for_user(user_drive_json: str | None = None):
    return _build_service(user_drive_json)

def get_drive_client_email(user_drive_json: str | None = None) -> str | None:
    raw = user_drive_json or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        return None
    try:
        return json.loads(raw).get("client_email")
    except Exception:
        return None

def _extract_folder_id(folder_id_or_url: str) -> tuple[str, str]:
    """
    Drive ID/URL থেকে ID বের করে। Returns (id, kind) যেখানে kind হলো 'folder' বা 'file'।
    /folders/ লিংক হলে সরাসরি folder ID, /file/d/ লিংক হলে সেটা একটা single file-এর ID
    (folder নয়) — caller-কে এই পার্থক্য জানাতে হয়, কারণ workflow-এর জন্য FOLDER লিংক লাগে।
    """
    s = (folder_id_or_url or "").strip()
    if "drive.google.com" in s:
        if "/folders/" in s:
            for part in s.split("/folders/")[1].split("/"):
                pid = part.split("?")[0]
                if pid:
                    return pid, "folder"
        if "/file/d/" in s:
            for part in s.split("/file/d/")[1].split("/"):
                pid = part.split("?")[0]
                if pid:
                    return pid, "file"
        # fallback — পুরনো heuristic (id= query param বা path segment)
        import urllib.parse
        qs = urllib.parse.urlparse(s)
        params = urllib.parse.parse_qs(qs.query)
        if "id" in params:
            return params["id"][0], "unknown"
        for part in qs.path.split("/"):
            part = part.split("?")[0]
            if len(part) > 20 and "-" not in part[:5]:
                return part, "unknown"
        return "", "unknown"
    # raw ID দেওয়া থাকলে — ধরে নেওয়া হচ্ছে এটা folder ID (যেমন আগে থেকে কাজ করত)
    return s, "folder" if s else "unknown"


def list_videos(folder_id: str, user_drive_json: str | None = None) -> list[dict]:
    fid, kind = _extract_folder_id(folder_id)
    if not fid:
        return []
    try:
        svc = _build_service(user_drive_json)
        if kind == "file":
            # ব্যবহারকারী folder-এর বদলে single FILE-এর link দিয়েছেন — সেই
            # ফাইলের parent folder বের করে সেটাকেই উৎস ফোল্ডার ধরে নেওয়া হচ্ছে,
            # যাতে workflow ভুলভাবে "Not Configured" হয়ে না যায়।
            meta = svc.files().get(fileId=fid, fields="parents,mimeType").execute()
            parents = meta.get("parents") or []
            if not parents:
                logging.error(f"Drive file {fid} has no parent folder to use as source")
                return []
            fid = parents[0]
        res = svc.files().list(
            q=f"'{fid}' in parents and mimeType contains 'video/' and trashed=false",
            fields="files(id,name,mimeType,webContentLink,size)",
            orderBy="createdTime",
            pageSize=50
        ).execute()
        return res.get("files", [])
    except Exception as e:
        logging.error(f"Drive list_videos error: {e}")
        return []

def get_public_url(file_id: str) -> str:
    return f"https://drive.google.com/uc?export=download&id={file_id}"

def move_to_success(file_id: str, success_folder_id: str, user_drive_json: str | None = None):
    if not success_folder_id:
        return
    try:
        svc = _build_service(user_drive_json)
        f = svc.files().get(fileId=file_id, fields="parents").execute()
        prev_parents = ",".join(f.get("parents", []))
        svc.files().update(
            fileId=file_id,
            addParents=success_folder_id,
            removeParents=prev_parents,
            fields="id,parents"
        ).execute()
    except Exception as e:
        logging.error(f"Drive move_to_success error: {e}")
