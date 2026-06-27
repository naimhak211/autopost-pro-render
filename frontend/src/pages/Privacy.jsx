export default function Privacy() {
  const host = window.location.hostname;
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1>📄 Privacy Policy</h1>
          <p className="subtitle">Facebook App Review এর জন্য প্রয়োজনীয়</p>
        </div>
      </div>

      <div className="card" style={{ lineHeight: 1.9, fontSize: 14 }}>
        <h2 style={{ marginBottom: 16 }}>Privacy Policy — AutoPost Pro</h2>
        <p className="muted" style={{ marginBottom: 20 }}>Last updated: {new Date().toLocaleDateString("bn-BD")}</p>

        <h3>১. আমরা কোন তথ্য সংগ্রহ করি?</h3>
        <p>AutoPost Pro শুধুমাত্র Facebook/Instagram/TikTok/YouTube-এর API Access Token সংগ্রহ করে,
          যা আপনার সোশ্যাল মিডিয়া পেজে পোস্ট করার জন্য প্রয়োজন।
          আমরা কোনো ব্যক্তিগত তথ্য, পাসওয়ার্ড বা ব্যাংকিং তথ্য সংগ্রহ করি না।</p>

        <h3 style={{ marginTop: 20 }}>২. তথ্য কীভাবে ব্যবহার করা হয়?</h3>
        <p>সংগ্রহিত Access Token শুধুমাত্র আপনার নির্দেশিত সোশ্যাল মিডিয়া পেজে ভিডিও ও পোস্ট প্রকাশ করতে ব্যবহার করা হয়।
          তৃতীয় পক্ষের সাথে কোনো তথ্য শেয়ার করা হয় না।</p>

        <h3 style={{ marginTop: 20 }}>৩. Facebook ডেটা ব্যবহার</h3>
        <p>AutoPost Pro Meta Platform Policy মেনে চলে। আমরা শুধুমাত্র
          <b> pages_show_list, pages_read_engagement, pages_manage_posts, business_management</b> permission ব্যবহার করি।
          Facebook ব্যবহারকারীর ব্যক্তিগত তথ্য, বন্ধু তালিকা বা মেসেজ access করা হয় না।</p>

        <h3 style={{ marginTop: 20 }}>৪. ডেটা সংরক্ষণ</h3>
        <p>সব তথ্য আপনার নিজের সার্ভারের SQLite database-এ সংরক্ষিত হয়।
          আমাদের কোনো কেন্দ্রীয় সার্ভারে আপনার ডেটা যায় না।</p>

        <h3 style={{ marginTop: 20 }}>৫. তথ্য মুছে ফেলা</h3>
        <p>Dashboard থেকে যেকোনো সময় Accounts মুছে দিলে সংশ্লিষ্ট Access Token মুছে যাবে।
          সম্পূর্ণ ডেটা মুছতে সার্ভারের <code>autopost.db</code> ফাইল delete করুন।</p>

        <h3 style={{ marginTop: 20 }}>৬. যোগাযোগ</h3>
        <p>যেকোনো প্রশ্নের জন্য Admin-এর সাথে যোগাযোগ করুন: <b>{host}</b></p>
      </div>
    </div>
  );
}
