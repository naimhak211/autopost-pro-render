import { useState } from "react";
import { generateCaptionAI, generateSeoAI } from "../api.js";

const TONES = ["প্রফেশনাল", "মজাদার", "আবেগময়", "ইনফরমেটিভ", "প্রমোশনাল", "ভাইরাল"];
const PLATFORMS = ["Facebook", "Instagram", "TikTok", "YouTube Shorts"];

export default function AICaption() {
  const [topic, setTopic]       = useState("");
  const [tone, setTone]         = useState("প্রফেশনাল");
  const [platform, setPlatform] = useState("Instagram");
  const [lang, setLang]         = useState("বাংলা");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState("");
  const [history, setHistory]   = useState([]);
  const [activeTab, setActiveTab] = useState("caption"); // caption | seo

  // SEO specific state
  const [seoTopic, setSeoTopic]       = useState("");
  const [seoKeyword, setSeoKeyword]   = useState("");
  const [seoType, setSeoType]         = useState("YouTube");
  const [seoResult, setSeoResult]     = useState(null);
  const [seoLoading, setSeoLoading]   = useState(false);

  // ── Caption Generator ────────────────────────────────
  const generateCaption = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const parsed = await generateCaptionAI({ topic, tone, platform, lang });
      if (!parsed.success) throw new Error(parsed.error);
      setResult(parsed);
      setHistory(h => [{ topic, platform, tone, ...parsed, time: new Date().toLocaleTimeString("bn-BD") }, ...h.slice(0, 4)]);
    } catch {
      setResult({ caption: "⚠️ AI সাড়া দিতে পারেনি। আবার চেষ্টা করুন।", hashtags: [], emoji_version: "", hook: "", cta: "", tip: "" });
    }
    setLoading(false);
  };

  // ── SEO Title Generator ──────────────────────────────
  const generateSEO = async () => {
    if (!seoTopic.trim()) return;
    setSeoLoading(true);
    setSeoResult(null);

    try {
      const parsed = await generateSeoAI({ topic: seoTopic, keyword: seoKeyword, platform: seoType });
      if (!parsed.success) throw new Error(parsed.error);
      setSeoResult(parsed);
    } catch {
      setSeoResult({ seo_title: "⚠️ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" });
    }
    setSeoLoading(false);
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const CopyBtn = ({ text, id }) => (
    <button className="copy-btn" onClick={() => copy(text, id)}>
      {copied === id ? "✅ কপি" : "📋 কপি"}
    </button>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🤖 AI কন্টেন্ট জেনারেটর</h1>
          <p className="subtitle">Claude AI দিয়ে Caption ও SEO Title তৈরি করুন</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="tab-row">
        <button className={`tab-btn ${activeTab === "caption" ? "active" : ""}`} onClick={() => setActiveTab("caption")}>
          ✍️ Caption Generator
        </button>
        <button className={`tab-btn ${activeTab === "seo" ? "active" : ""}`} onClick={() => setActiveTab("seo")}>
          🔍 SEO Title Generator
        </button>
      </div>

      {/* ── CAPTION TAB ── */}
      {activeTab === "caption" && (
        <div className="two-col">
          <div className="card">
            <h3>ক্যাপশন তৈরি করুন</h3>

            <label>পোস্টের বিষয়</label>
            <textarea rows={3}
              placeholder="যেমন: আমাদের নতুন পণ্য লঞ্চ, সেল অফার, ব্র্যান্ড স্টোরি..."
              value={topic} onChange={e => setTopic(e.target.value)} />

            <label>প্ল্যাটফর্ম</label>
            <div className="platform-picker">
              {PLATFORMS.map(p => (
                <button key={p} className={`plat-pick-btn ${platform === p ? "selected" : ""}`}
                  onClick={() => setPlatform(p)}>{p}</button>
              ))}
            </div>

            <label>টোন</label>
            <div className="tone-picker">
              {TONES.map(t => (
                <button key={t} className={`tone-btn ${tone === t ? "selected" : ""}`}
                  onClick={() => setTone(t)}>{t}</button>
              ))}
            </div>

            <label>ভাষা</label>
            <div className="platform-picker">
              {["বাংলা", "English", "বাংলা + English"].map(l => (
                <button key={l} className={`plat-pick-btn ${lang === l ? "selected" : ""}`}
                  onClick={() => setLang(l)}>{l}</button>
              ))}
            </div>

            <button className="btn-primary full-width mt" onClick={generateCaption} disabled={loading}>
              {loading ? "⏳ তৈরি হচ্ছে..." : "✨ ক্যাপশন তৈরি করুন"}
            </button>
          </div>

          <div className="card">
            <h3>ফলাফল</h3>
            {loading && <div className="ai-loading"><div className="pulse-ring" /><p>AI চিন্তা করছে...</p></div>}
            {result && !loading && (
              <div className="ai-result">
                {result.hook && (
                  <div className="result-block">
                    <div className="result-label">🎣 Hook (মনোযোগ টানার লাইন)</div>
                    <p className="result-text" style={{ color: "var(--accent)" }}>{result.hook}</p>
                    <CopyBtn text={result.hook} id="hook" />
                  </div>
                )}
                <div className="result-block">
                  <div className="result-label">📝 মূল ক্যাপশন</div>
                  <p className="result-text">{result.caption}</p>
                  <CopyBtn text={result.caption} id="caption" />
                </div>
                {result.cta && (
                  <div className="result-block">
                    <div className="result-label">👆 Call to Action</div>
                    <p className="result-text">{result.cta}</p>
                    <CopyBtn text={result.cta} id="cta" />
                  </div>
                )}
                {result.emoji_version && (
                  <div className="result-block">
                    <div className="result-label">😊 ইমোজি ভার্সন</div>
                    <p className="result-text">{result.emoji_version}</p>
                    <CopyBtn text={result.emoji_version} id="emoji" />
                  </div>
                )}
                {result.hashtags?.length > 0 && (
                  <div className="result-block">
                    <div className="result-label"># হ্যাশট্যাগ</div>
                    <div className="hashtag-wrap">
                      {result.hashtags.map((h, i) => <span className="hashtag" key={i}>{h}</span>)}
                    </div>
                    <CopyBtn text={result.hashtags.join(" ")} id="hashtags" />
                  </div>
                )}
                {result.tip && <div className="tip-box">💡 <b>টিপস:</b> {result.tip}</div>}
                <button className="btn-primary full-width mt" onClick={generateCaption}>🔄 নতুন ভার্সন</button>
              </div>
            )}
            {!result && !loading && (
              <div className="empty-state"><div className="empty-icon">✍️</div><p>বাম দিকে তথ্য দিন</p></div>
            )}
          </div>
        </div>
      )}

      {/* ── SEO TAB ── */}
      {activeTab === "seo" && (
        <div className="two-col">
          <div className="card">
            <h3>SEO তথ্য দিন</h3>

            <label>ভিডিও / পোস্টের বিষয়</label>
            <textarea rows={3}
              placeholder="যেমন: বাংলাদেশে ফ্রিল্যান্সিং শুরু করার উপায়, Telegram bot বানানো..."
              value={seoTopic} onChange={e => setSeoTopic(e.target.value)} />

            <label>মূল কীওয়ার্ড (optional)</label>
            <input placeholder="যেমন: freelancing bangladesh, telegram bot"
              value={seoKeyword} onChange={e => setSeoKeyword(e.target.value)} />

            <label>প্ল্যাটফর্ম</label>
            <div className="platform-picker">
              {["YouTube", "TikTok", "Facebook", "Instagram", "Blog"].map(p => (
                <button key={p} className={`plat-pick-btn ${seoType === p ? "selected" : ""}`}
                  onClick={() => setSeoType(p)}>{p}</button>
              ))}
            </div>

            <button className="btn-primary full-width mt" onClick={generateSEO} disabled={seoLoading}>
              {seoLoading ? "⏳ বিশ্লেষণ হচ্ছে..." : "🔍 SEO কন্টেন্ট তৈরি করুন"}
            </button>
          </div>

          <div className="card">
            <h3>SEO ফলাফল</h3>
            {seoLoading && <div className="ai-loading"><div className="pulse-ring" /><p>SEO বিশ্লেষণ হচ্ছে...</p></div>}
            {seoResult && !seoLoading && (
              <div className="ai-result">
                {/* Main Title */}
                <div className="result-block" style={{ borderLeft: "3px solid var(--accent)" }}>
                  <div className="result-label">🏆 SEO Title (প্রধান)</div>
                  <p className="result-text" style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>
                    {seoResult.seo_title}
                  </p>
                  <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
                    {seoResult.seo_title?.length || 0} characters
                  </p>
                  <CopyBtn text={seoResult.seo_title} id="seo_title" />
                </div>

                {/* Alt titles */}
                {seoResult.alt_titles?.length > 0 && (
                  <div className="result-block">
                    <div className="result-label">📋 বিকল্প Title (A/B Test)</div>
                    {seoResult.alt_titles.map((t, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <p style={{ fontSize: 13, flex: 1 }}>{t}</p>
                        <CopyBtn text={t} id={`alt${i}`} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                {seoResult.description && (
                  <div className="result-block">
                    <div className="result-label">📄 SEO Description</div>
                    <p className="result-text">{seoResult.description}</p>
                    <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{seoResult.description?.length} / 160 characters</p>
                    <CopyBtn text={seoResult.description} id="desc" />
                  </div>
                )}

                {/* Thumbnail text */}
                {seoResult.thumbnail_text && (
                  <div className="result-block" style={{ background: "var(--accent)10", borderColor: "var(--accent)40" }}>
                    <div className="result-label">🖼️ Thumbnail টেক্সট</div>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)", letterSpacing: 1 }}>
                      {seoResult.thumbnail_text}
                    </p>
                    <CopyBtn text={seoResult.thumbnail_text} id="thumb" />
                  </div>
                )}

                {/* Tags */}
                {seoResult.tags?.length > 0 && (
                  <div className="result-block">
                    <div className="result-label">🏷️ Tags / Keywords</div>
                    <div className="hashtag-wrap">
                      {seoResult.tags.map((t, i) => <span className="hashtag" key={i}>{t}</span>)}
                    </div>
                    <CopyBtn text={seoResult.tags.join(", ")} id="tags" />
                  </div>
                )}

                {/* Long-tail keywords */}
                {seoResult.keywords?.length > 0 && (
                  <div className="result-block">
                    <div className="result-label">🔑 Long-tail Keywords</div>
                    {seoResult.keywords.map((k, i) => (
                      <div key={i} style={{ padding: "4px 0", fontSize: 13, borderBottom: "1px solid var(--border)40" }}>
                        🔹 {k}
                      </div>
                    ))}
                  </div>
                )}

                {/* Best upload time */}
                {seoResult.best_upload_time && (
                  <div className="tip-box">⏰ <b>সেরা আপলোড সময়:</b> {seoResult.best_upload_time}</div>
                )}

                {/* SEO tips */}
                {seoResult.seo_score_tips?.length > 0 && (
                  <div className="result-block">
                    <div className="result-label">💡 SEO উন্নতির টিপস</div>
                    {seoResult.seo_score_tips.map((t, i) => (
                      <p key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)40" }}>
                        ✅ {t}
                      </p>
                    ))}
                  </div>
                )}

                {/* Copy all button */}
                <button className="btn-primary full-width mt" onClick={() => copy(
                  `Title: ${seoResult.seo_title}\n\nDescription: ${seoResult.description}\n\nTags: ${seoResult.tags?.join(", ")}`,
                  "all"
                )}>
                  {copied === "all" ? "✅ সব কপি হয়েছে!" : "📋 সব একসাথে কপি করুন"}
                </button>

                <button className="btn-ghost full-width mt" onClick={generateSEO}>🔄 নতুন ভার্সন</button>
              </div>
            )}
            {!seoResult && !seoLoading && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>বাম দিকে বিষয় দিয়ে SEO কন্টেন্ট তৈরি করুন</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History (caption only) */}
      {activeTab === "caption" && history.length > 0 && (
        <div className="card">
          <h3>সাম্প্রতিক ক্যাপশন</h3>
          <div className="history-list">
            {history.map((h, i) => (
              <div className="history-item" key={i}>
                <div className="history-meta">
                  <span className="plat-tag">{h.platform}</span>
                  <span className="muted">{h.time}</span>
                </div>
                <p className="history-topic">বিষয়: {h.topic}</p>
                <p className="history-caption">{h.caption?.slice(0, 100)}...</p>
                <CopyBtn text={h.caption} id={`hist${i}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
