"""
Platform posting modules
Each function returns: (success: bool, message: str)
"""
import requests, logging, os

# ── FACEBOOK ─────────────────────────────────────────────────────────────────
def facebook_post_video(page_token: str, page_id: str, caption: str, video_url: str) -> tuple[bool, str]:
    """Post video to Facebook Page via Graph API"""
    try:
        res = requests.post(
            f"https://graph.facebook.com/{page_id}/videos",
            data={
                "description": caption,
                "file_url": video_url,
                "access_token": page_token,
            },
            timeout=30
        ).json()
        if "id" in res:
            return True, f"Post ID: {res['id']}"
        err = res.get("error", {}).get("message", "Unknown Facebook error")
        return False, err
    except Exception as e:
        return False, str(e)

def facebook_post_photo(page_token: str, page_id: str, caption: str, image_url: str) -> tuple[bool, str]:
    """Post photo to Facebook Page"""
    try:
        res = requests.post(
            f"https://graph.facebook.com/{page_id}/photos",
            data={"caption": caption, "url": image_url, "access_token": page_token},
            timeout=30
        ).json()
        if "post_id" in res or "id" in res:
            return True, f"Post ID: {res.get('post_id') or res.get('id')}"
        return False, res.get("error", {}).get("message", "Unknown error")
    except Exception as e:
        return False, str(e)

def facebook_get_pages(token: str) -> list[dict]:
    """Get all pages the user manages (personal + Business Manager owned/client pages)"""
    try:
        res = requests.get(
            f"https://graph.facebook.com/me/accounts?fields=id,name,access_token&access_token={token}",
            timeout=15
        ).json()
        pages = list(res.get("data", []))
        # Business Manager owned/client pages (visible if the FB user logging in is an admin of that Business)
        try:
            biz = requests.get(
                f"https://graph.facebook.com/me/businesses?access_token={token}", timeout=15
            ).json()
            for b in biz.get("data", []):
                bid = b.get("id")
                for kind in ("owned_pages", "client_pages"):
                    bp = requests.get(
                        f"https://graph.facebook.com/{bid}/{kind}?fields=id,name,access_token&access_token={token}",
                        timeout=15
                    ).json()
                    for p in bp.get("data", []):
                        if not any(existing["id"] == p["id"] for existing in pages):
                            pages.append(p)
        except Exception as e:
            logging.warning(f"Business Manager pages fetch skipped: {e}")
        return pages
    except Exception as e:
        logging.error(f"FB get pages error: {e}")
        return []

def facebook_post_video_file(page_token: str, page_id: str, caption: str, video_path: str) -> tuple[bool, str]:
    """Post a LOCAL video file to a Facebook Page via direct binary upload.
    Used when the video has no public URL (e.g. freshly downloaded from TikTok)."""
    try:
        with open(video_path, "rb") as f:
            res = requests.post(
                f"https://graph-video.facebook.com/{page_id}/videos",
                data={"description": caption, "access_token": page_token},
                files={"source": f},
                timeout=180,
            ).json()
        if "id" in res:
            return True, f"Post ID: {res['id']}"
        return False, res.get("error", {}).get("message", "Unknown Facebook error")
    except Exception as e:
        return False, str(e)

def facebook_get_page_followers(page_token: str, page_id: str) -> int | None:
    """Fetch current follower count for a Page (growth tracking)"""
    try:
        res = requests.get(
            f"https://graph.facebook.com/{page_id}",
            params={"fields": "followers_count,fan_count", "access_token": page_token},
            timeout=15,
        ).json()
        val = res.get("followers_count")
        return val if val is not None else res.get("fan_count")
    except Exception as e:
        logging.error(f"FB followers fetch error: {e}")
        return None

# ── INSTAGRAM ────────────────────────────────────────────────────────────────
def instagram_post_reel(access_token: str, ig_user_id: str, caption: str, video_url: str) -> tuple[bool, str]:
    """Post Reel to Instagram Business Account"""
    try:
        # Step 1: Create media container
        container = requests.post(
            f"https://graph.facebook.com/{ig_user_id}/media",
            data={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": caption,
                "share_to_feed": "true",
                "access_token": access_token,
            },
            timeout=30
        ).json()

        container_id = container.get("id")
        if not container_id:
            return False, container.get("error", {}).get("message", "Container creation failed")

        # Step 2: Wait for processing then publish
        import time
        time.sleep(10)

        pub = requests.post(
            f"https://graph.facebook.com/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token},
            timeout=30
        ).json()

        if "id" in pub:
            return True, f"Post ID: {pub['id']}"
        return False, pub.get("error", {}).get("message", "Publish failed")
    except Exception as e:
        return False, str(e)

def instagram_post_photo(access_token: str, ig_user_id: str, caption: str, image_url: str) -> tuple[bool, str]:
    """Post image to Instagram"""
    try:
        container = requests.post(
            f"https://graph.facebook.com/{ig_user_id}/media",
            data={"image_url": image_url, "caption": caption, "access_token": access_token},
            timeout=30
        ).json()
        container_id = container.get("id")
        if not container_id:
            return False, container.get("error", {}).get("message", "Container error")
        pub = requests.post(
            f"https://graph.facebook.com/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token},
            timeout=30
        ).json()
        if "id" in pub:
            return True, f"Post ID: {pub['id']}"
        return False, pub.get("error", {}).get("message", "Publish failed")
    except Exception as e:
        return False, str(e)

# ── TIKTOK ───────────────────────────────────────────────────────────────────
def tiktok_post_video(access_token: str, caption: str, video_path: str) -> tuple[bool, str]:
    """
    Upload video to TikTok via Content Posting API v2
    Requires: TikTok for Developers app with video.publish scope
    """
    try:
        # Step 1: Init upload
        init_res = requests.post(
            "https://open.tiktokapis.com/v2/post/publish/video/init/",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={
                "post_info": {
                    "title": caption[:150],
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": os.path.getsize(video_path),
                    "chunk_size": os.path.getsize(video_path),
                    "total_chunk_count": 1,
                }
            },
            timeout=30
        ).json()

        upload_url = init_res.get("data", {}).get("upload_url")
        publish_id = init_res.get("data", {}).get("publish_id")

        if not upload_url:
            return False, f"TikTok init failed: {init_res.get('error', {}).get('message', 'Unknown')}"

        # Step 2: Upload video
        file_size = os.path.getsize(video_path)
        with open(video_path, 'rb') as f:
            upload_res = requests.put(
                upload_url,
                headers={
                    "Content-Range": f"bytes 0-{file_size-1}/{file_size}",
                    "Content-Length": str(file_size),
                    "Content-Type": "video/mp4",
                },
                data=f,
                timeout=120
            )

        if upload_res.status_code in [200, 201]:
            return True, f"Publish ID: {publish_id}"
        return False, f"Upload failed: HTTP {upload_res.status_code}"
    except Exception as e:
        return False, str(e)

# ── YOUTUBE ──────────────────────────────────────────────────────────────────
def youtube_upload_short(access_token: str, title: str, description: str, video_path: str) -> tuple[bool, str]:
    """
    Upload YouTube Short via YouTube Data API v3
    Requires: OAuth2 token with youtube.upload scope
    """
    try:
        file_size = os.path.getsize(video_path)

        # Init resumable upload
        init_res = requests.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Upload-Content-Type": "video/mp4",
                "X-Upload-Content-Length": str(file_size),
            },
            json={
                "snippet": {
                    "title": title[:100],
                    "description": description,
                    "tags": ["shorts", "viral", "trending"],
                    "categoryId": "22",
                },
                "status": {
                    "privacyStatus": "public",
                    "selfDeclaredMadeForKids": False,
                }
            },
            timeout=30
        )

        upload_url = init_res.headers.get("Location")
        if not upload_url:
            return False, "YouTube upload init failed"

        # Upload the file
        with open(video_path, 'rb') as f:
            upload_res = requests.put(
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(file_size),
                },
                data=f,
                timeout=300
            )

        if upload_res.status_code in [200, 201]:
            data = upload_res.json()
            video_id = data.get("id")
            return True, f"https://youtube.com/shorts/{video_id}"
        return False, f"YouTube upload failed: HTTP {upload_res.status_code}"
    except Exception as e:
        return False, str(e)
