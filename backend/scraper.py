"""
Video scraper — download TikTok & YouTube Shorts using yt-dlp
Install: pip install yt-dlp --break-system-packages
"""
import subprocess, os, logging, re

DOWNLOAD_DIR = "/tmp/autopost_videos"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def _run_ytdlp(url: str, output_template: str, extra_args: list = []) -> tuple[bool, str]:
    """Run yt-dlp and return (success, file_path_or_error)"""
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--format", "mp4/bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        *extra_args,
        url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            # Find the downloaded file
            lines = result.stdout.split('\n')
            for line in lines:
                if '[download] Destination:' in line or 'Merging formats into' in line:
                    path = line.split('"')[-2] if '"' in line else line.split()[-1]
                    if os.path.exists(path):
                        return True, path
            # fallback: search dir
            files = sorted(
                [os.path.join(DOWNLOAD_DIR, f) for f in os.listdir(DOWNLOAD_DIR) if f.endswith('.mp4')],
                key=os.path.getmtime, reverse=True
            )
            if files:
                return True, files[0]
            return False, "File not found after download"
        return False, result.stderr[:300]
    except subprocess.TimeoutExpired:
        return False, "Download timed out (>2 min)"
    except FileNotFoundError:
        return False, "yt-dlp not installed. Run: pip install yt-dlp --break-system-packages"
    except Exception as e:
        return False, str(e)

def download_tiktok(url: str) -> tuple[bool, str]:
    """Download TikTok video (removes watermark)"""
    output = os.path.join(DOWNLOAD_DIR, "tiktok_%(id)s.mp4")
    return _run_ytdlp(url, output, ["--no-check-certificates"])

def download_youtube(url: str) -> tuple[bool, str]:
    """Download YouTube / Shorts video"""
    output = os.path.join(DOWNLOAD_DIR, "yt_%(id)s.mp4")
    return _run_ytdlp(url, output)

def scrape_tiktok_profile(username: str, limit: int = 5) -> list[dict]:
    """Get latest N videos from a TikTok profile"""
    url = f"https://www.tiktok.com/@{username}"
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--playlist-end", str(limit),
        "--dump-json",
        url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        videos = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                import json
                data = json.loads(line)
                videos.append({
                    "id": data.get("id"),
                    "title": data.get("title", ""),
                    "url": data.get("url") or f"https://www.tiktok.com/@{username}/video/{data.get('id')}",
                    "duration": data.get("duration"),
                    "view_count": data.get("view_count"),
                })
            except:
                continue
        return videos
    except Exception as e:
        logging.error(f"TikTok profile scrape error: {e}")
        return []

def scrape_youtube_channel(channel_url: str, limit: int = 5) -> list[dict]:
    """Get latest N videos from a YouTube channel"""
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--playlist-end", str(limit),
        "--dump-json",
        channel_url
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        videos = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                import json
                data = json.loads(line)
                videos.append({
                    "id": data.get("id"),
                    "title": data.get("title", ""),
                    "url": f"https://www.youtube.com/watch?v={data.get('id')}",
                    "duration": data.get("duration"),
                    "view_count": data.get("view_count"),
                })
            except:
                continue
        return videos
    except Exception as e:
        logging.error(f"YouTube channel scrape error: {e}")
        return []

def cleanup_old_videos(max_age_hours: int = 24):
    """Delete downloaded videos older than N hours"""
    import time
    now = time.time()
    for fname in os.listdir(DOWNLOAD_DIR):
        fpath = os.path.join(DOWNLOAD_DIR, fname)
        if os.path.isfile(fpath):
            age_hours = (now - os.path.getmtime(fpath)) / 3600
            if age_hours > max_age_hours:
                os.remove(fpath)
                logging.info(f"Cleaned up: {fname}")
