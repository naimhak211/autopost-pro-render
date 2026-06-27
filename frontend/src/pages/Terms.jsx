export default function Terms() {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1>📋 Terms of Service</h1>
          <p className="subtitle">Facebook App Review এর জন্য প্রয়োজনীয়</p>
        </div>
      </div>

      <div className="card" style={{ lineHeight: 1.9, fontSize: 14 }}>
        <h2 style={{ marginBottom: 16 }}>Terms of Service — AutoPost Pro</h2>
        <p className="muted" style={{ marginBottom: 20 }}>Last updated: {new Date().toLocaleDateString("bn-BD")}</p>

        <h3>১. সেবার বিবরণ</h3>
        <p>AutoPost Pro একটি সোশ্যাল মিডিয়া অটোমেশন টুল যা আপনাকে Facebook, Instagram, TikTok ও YouTube-এ
          স্বয়ংক্রিয়ভাবে ভিডিও পোস্ট করতে সাহায্য করে।</p>

        <h3 style={{ marginTop: 20 }}>২. ব্যবহারের শর্ত</h3>
        <p>এই সফটওয়্যার ব্যবহার করে আপনি নিশ্চিত করছেন যে:</p>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>আপনি যে পেজ বা অ্যাকাউন্টে পোস্ট করবেন সেটির আপনার বৈধ অ্যাক্সেস আছে</li>
          <li>পোস্ট করা কন্টেন্ট Meta, TikTok ও YouTube-এর Community Guidelines মেনে চলবে</li>
          <li>কপিরাইট লঙ্ঘন বা স্প্যাম কনটেন্ট পোস্ট করা হবে না</li>
          <li>অন্যের কনটেন্ট রিপোস্ট করার আগে প্রয়োজনীয় অনুমতি নেওয়া হবে</li>
        </ul>

        <h3 style={{ marginTop: 20 }}>৩. দায়সীমাবদ্ধতা</h3>
        <p>AutoPost Pro ব্যবহারকারীর কন্টেন্ট বা পোস্টের জন্য দায়ী নয়।
          প্ল্যাটফর্ম নীতি লঙ্ঘনের কারণে অ্যাকাউন্ট suspend বা বন্ধ হলে কর্তৃপক্ষ দায়ী থাকবে না।</p>

        <h3 style={{ marginTop: 20 }}>৪. পরিষেবা পরিবর্তন</h3>
        <p>কর্তৃপক্ষ যেকোনো সময় সফটওয়্যার আপডেট বা পরিষেবা পরিবর্তন করার অধিকার রাখে।</p>

        <h3 style={{ marginTop: 20 }}>৫. মেধাস্বত্ব</h3>
        <p>AutoPost Pro সফটওয়্যারের সকল মেধাস্বত্ব সংরক্ষিত। অনুমতি ছাড়া পুনরায় বিতরণ নিষিদ্ধ।</p>
      </div>
    </div>
  );
}
