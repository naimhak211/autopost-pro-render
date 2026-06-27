"""
AI Content Generator (server-side)
Calls the Anthropic API directly from the backend using ANTHROPIC_API_KEY.
This MUST run on the server — calling api.anthropic.com from the browser
with no key (as the old frontend code did) only works inside Claude.ai's
artifact sandbox, not in a real deployed app.
"""
import os, json, logging, requests

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"


def _call_claude(prompt: str, max_tokens: int = 1200) -> dict | None:
    """Calls Claude and parses a JSON object out of the response text."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        logging.error("ANTHROPIC_API_KEY missing in .env")
        return None
    try:
        res = requests.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        data = res.json()
        if "content" not in data:
            logging.error(f"Claude API error: {data}")
            return None
        text = "".join(b.get("text", "") for b in data["content"])
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        logging.error(f"Claude call failed: {e}")
        return None


def generate_caption(topic: str, tone: str = "প্রফেশনাল", platform: str = "Instagram", lang: str = "বাংলা") -> dict | None:
    prompt = f"""তুমি একজন সোশ্যাল মিডিয়া কন্টেন্ট এক্সপার্ট।

নিচের তথ্য অনুযায়ী {platform}-এর জন্য একটি আকর্ষণীয় পোস্ট ক্যাপশন তৈরি করো:

বিষয়: {topic}
টোন: {tone}
ভাষা: {lang}
প্ল্যাটফর্ম: {platform}

শুধুমাত্র JSON রিটার্ন করো (কোনো markdown নয়):
{{
  "caption": "মূল ক্যাপশন (২-৪ লাইন)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"],
  "emoji_version": "ইমোজি সহ সংক্ষিপ্ত ভার্সন",
  "hook": "প্রথম লাইন যা মনোযোগ টানবে",
  "cta": "Call to action (লাইক/শেয়ার/কমেন্ট উৎসাহিত করা)",
  "tip": "{platform}-এ এই পোস্টের জন্য একটি টিপস"
}}"""
    return _call_claude(prompt, max_tokens=1000)


def generate_seo(topic: str, keyword: str = "", platform: str = "YouTube") -> dict | None:
    prompt = f"""তুমি একজন SEO বিশেষজ্ঞ। {platform} এর জন্য SEO-optimized কন্টেন্ট তৈরি করো।

বিষয়: {topic}
মূল কীওয়ার্ড: {keyword or "auto detect করো"}
প্ল্যাটফর্ম: {platform}

শুধুমাত্র JSON রিটার্ন করো:
{{
  "seo_title": "SEO optimized title (60 characters এর মধ্যে, keyword সহ)",
  "alt_titles": ["বিকল্প title 1", "বিকল্প title 2", "বিকল্প title 3"],
  "description": "SEO description (150-160 characters, keyword সহ)",
  "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "keywords": ["primary keyword", "secondary keyword", "long tail keyword 1", "long tail keyword 2"],
  "thumbnail_text": "Thumbnail এ লেখার জন্য ছোট টেক্সট (৫ শব্দের মধ্যে)",
  "seo_score_tips": ["টিপস ১", "টিপস ২", "টিপস ৩"],
  "best_upload_time": "{platform} এ পোস্ট করার সেরা সময়"
}}"""
    return _call_claude(prompt, max_tokens=1200)
