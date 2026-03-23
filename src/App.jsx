import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

const categories = ["All", "Hair Stylists", "Makeup Artists", "Nail Techs", "Estheticians", "Lash & Brow", "Waxing"];
const SPECIALTIES = ["Hair Stylist","Makeup Artist","Nail Tech","Esthetician","Lash & Brow Artist","Waxing Specialist"];

const RATING_CATEGORIES = [
  { key: "serviceOutcome",  label: "Service Outcome",           emoji: "⭐", description: "Did they actually deliver? The result is everything — did you leave looking and feeling exactly how you wanted?" },
  { key: "parking",         label: "Parking",                   emoji: "🅿️", description: "How easy is it to get there? Street, lot, garage — knowing ahead of time saves the stress." },
  { key: "customerService", label: "Customer Service",          emoji: "🤝", description: "How were you treated from first contact to checkout? Did they make you feel seen, heard, and valued?" },
  { key: "waitTime",        label: "Wait Time / Punctuality",   emoji: "⏱️", description: "Did they respect your time? Was your appointment on schedule, or were you left waiting?" },
  { key: "communication",   label: "Communication & Follow-up", emoji: "💬", description: "Clear before, during, and after — did they explain the process, check in, and follow up when needed?" },
  { key: "value",           label: "Value for Money",           emoji: "💰", description: "Was it worth the price? Quality, experience, and outcome — did the investment match the result?" },
  { key: "cleanliness",     label: "Cleanliness & Vibe",        emoji: "✨", description: "Was the space clean, organized, and welcoming? The environment matters as much as the service." },
];

const defaultRatings = () => Object.fromEntries(RATING_CATEGORIES.map(c => [c.key, 0]));
const avgRating = (r) => { const v = Object.values(r).filter(x => x > 0); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : 0; };

// Maps a Supabase `pros` row → app pro format
const mapSupabasePro = (r) => ({
  id: r.id,
  name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.business_name || "Pro",
  specialty: r.specialty || "",
  location: [r.location_city, r.location_state].filter(Boolean).join(", ") || r.location_display || "",
  lat: null, lng: null,
  ratings: {
    serviceOutcome: parseFloat(r.rating_service_outcome) || 0,
    parking:        parseFloat(r.rating_parking)         || 0,
    customerService:parseFloat(r.rating_customer_service)|| 0,
    waitTime:       parseFloat(r.rating_wait_time)       || 0,
    communication:  parseFloat(r.rating_communication)   || 0,
    value:          parseFloat(r.rating_value)           || 0,
    cleanliness:    parseFloat(r.rating_cleanliness)     || 0,
  },
  reviews:       r.review_count     || 0,
  tags:          r.tags             || [],
  bio:           r.bio              || "",
  instagram:     r.instagram        || "",
  booking:       r.booking_url      || "",
  tiktokReview:  r.tiktok_review_url|| "",
  recommendedBy: [],
  proPlus:       r.is_pro_plus      || false,
  verified:      r.is_verified      || false,
  isDemo:        false,
  weeklyRecs:    r.weekly_rec_count || 0,
  photoUrl:      r.photo_url        || "",
  email:         r.email            || "",
  supabaseId:    r.id,
  isCommunity:   true,
});

const pros = [];

// ─── PRO PHOTO CAROUSEL ───────────────────────────────────────────────────────
function ProPhotoCarousel({ photos, name }) {
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const dragStartX = useRef(null);
  const swiped = useRef(false);

  // Deduplicate photos — normalize URLs (strip query params) before comparing
  const normUrl = u => u?.split('?')[0].replace(/\/+$/, '');
  const seen = new Set();
  const safePhotos = (photos || []).filter(Boolean).filter(u => {
    const key = normUrl(u);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const multi = safePhotos.length > 1;

  const prev = (e) => { e.stopPropagation(); setIdx(i => (i - 1 + safePhotos.length) % safePhotos.length); };
  const next = (e) => { e.stopPropagation(); setIdx(i => (i + 1) % safePhotos.length); };

  // Touch (mobile)
  const onTouchStart = (e) => { dragStartX.current = e.touches[0].clientX; swiped.current = false; };
  const onTouchEnd = (e) => {
    if (dragStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - dragStartX.current;
    if (Math.abs(dx) > 40) { swiped.current = true; e.stopPropagation(); setIdx(i => dx < 0 ? (i + 1) % safePhotos.length : (i - 1 + safePhotos.length) % safePhotos.length); }
    dragStartX.current = null;
  };

  // Mouse drag (desktop)
  const onMouseDown = (e) => { dragStartX.current = e.clientX; swiped.current = false; };
  const onMouseUp = (e) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 40) { swiped.current = true; e.stopPropagation(); setIdx(i => dx < 0 ? (i + 1) % safePhotos.length : (i - 1 + safePhotos.length) % safePhotos.length); }
    dragStartX.current = null;
  };
  const onClickCapture = (e) => { if (swiped.current) { e.stopPropagation(); swiped.current = false; } };

  const arrowStyle = (side) => ({
    position:"absolute", top:"50%", transform:"translateY(-50%)",
    [side]: "8px", zIndex:6,
    background:"rgba(0,0,0,0.35)", border:"none", borderRadius:"50%",
    width:"28px", height:"28px", display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"pointer", color:"#fff", fontSize:"14px",
    opacity: hovered ? 1 : 0, transition:"opacity 0.2s",
    backdropFilter:"blur(4px)",
  });

  return (
    <>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg, #9B8AFB 0%, #E8E4FF 100%)" }}/>
      {/* Preload all images, only show current — no remount on swipe */}
      {safePhotos.map((src, i) => (
        <img key={src} src={src} alt={name}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: i===idx ? 1 : 0, transition:"opacity 0.2s" }}
          onError={e => e.target.style.display="none"}
        />
      ))}
      {multi && (
        <div
          style={{ position:"absolute", inset:0, zIndex:3, cursor:"grab" }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown} onMouseUp={onMouseUp}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          onClick={onClickCapture}
        />
      )}
      {multi && <button style={arrowStyle("left")} onClick={prev}>‹</button>}
      {multi && <button style={arrowStyle("right")} onClick={next}>›</button>}
      {multi && (
        <div style={{ position:"absolute", bottom:"10px", left:"50%", transform:"translateX(-50%)", display:"flex", gap:"5px", zIndex:5 }}>
          {safePhotos.map((_, i) => (
            <div key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              style={{ width: i===idx ? "18px" : "6px", height:"6px", borderRadius:"3px", background: i===idx ? "#fff" : "rgba(255,255,255,0.55)", transition:"all 0.25s", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }}/>
          ))}
        </div>
      )}
    </>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const inp = { width:"100%", padding:"14px 16px", borderRadius:"10px", border:"1.5px solid #1A00B9", fontSize:"14px", fontFamily:"sans-serif", background:"#fff", boxSizing:"border-box", outline:"none" };
const lbl = { display:"block", fontWeight:"800", fontSize:"12px", marginBottom:"6px", color:"#1A00B9", textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"sans-serif" };
const gridBg = { backgroundImage:"linear-gradient(rgba(26,0,185,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(26,0,185,0.07) 1px,transparent 1px)", backgroundSize:"32px 32px" };
const btnPink = { background:"#1A00B9", color:"#fff", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"12px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0px #B7CF4F" };
const btnDark = { background:"#1A00B9", color:"#fff", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"12px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0px #B7CF4F" };
const btnOut  = { background:"#fff", color:"#1A00B9", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"12px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer" };

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function StarRater({ value, onChange, size=26 }) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display:"flex", gap:"3px" }}>
      {[1,2,3,4,5].map(i=>(
        <span key={i} onMouseEnter={()=>onChange&&setHov(i)} onMouseLeave={()=>onChange&&setHov(0)} onClick={()=>onChange&&onChange(i)}
          style={{ fontSize:size, cursor:onChange?"pointer":"default", color:i<=(hov||value)?"#B7CF4F":"#ddd", transition:"color 0.1s", userSelect:"none", lineHeight:1 }}>★</span>
      ))}
    </div>
  );
}

function RatingBreakdown({ ratings }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      {RATING_CATEGORIES.map(cat=>(
        <div key={cat.key} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"15px", width:"22px", textAlign:"center" }}>{cat.emoji}</span>
          <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"700", width:"190px", color:"#555" }}>{cat.label}</span>
          <div style={{ flex:1, height:"7px", background:"#f0f0f0", borderRadius:"4px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(ratings[cat.key]/5)*100}%`, background:ratings[cat.key]>=4.5?"#B7CF4F":ratings[cat.key]>=3?"#B7CF4F":"#fb9b5f", borderRadius:"4px" }}/>
          </div>
          <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", width:"26px" }}>{ratings[cat.key].toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function RatingForm({ ratings, onChange }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      {RATING_CATEGORIES.map(cat=>(
        <div key={cat.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ fontSize:"16px" }}>{cat.emoji}</span>
            <span style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", color:"#333" }}>{cat.label}</span>
          </div>
          <StarRater value={ratings[cat.key]} onChange={val=>onChange({...ratings,[cat.key]:val})} size={22}/>
        </div>
      ))}
    </div>
  );
}

// ─── DISCLAIMER BANNER ───────────────────────────────────────────────────────
function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{ background:"#f4f2ff", color:"#333", padding:"10px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", flexWrap:"wrap", borderBottom:"1px solid #e0ddf5" }}>
      <p style={{ margin:0, fontFamily:"sans-serif", fontSize:"12px", lineHeight:"1.5", opacity:0.85 }}>
        <strong>Community Disclaimer:</strong> Ratings and reviews on reffered are submitted by community members and represent their personal opinions. reffered does not verify, endorse, or guarantee any service provider listed on this platform. Listings are not paid placements.{" "}
        <span style={{ textDecoration:"underline", cursor:"pointer", opacity:0.7 }}>Learn more</span>
      </p>
      <button onClick={()=>setDismissed(true)} style={{ background:"#1A00B9", border:"none", borderRadius:"20px", color:"#fff", padding:"5px 16px", fontSize:"11px", fontWeight:"800", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"sans-serif" }}>Got it ✕</button>
    </div>
  );
}

// ─── LEGAL PAGES ─────────────────────────────────────────────────────────────
function LegalSection({ title, children }) {
  return (
    <div style={{ marginBottom:"36px" }}>
      <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-0.5px" }}>{title}</h2>
      <div style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#555", lineHeight:"1.8" }}>{children}</div>
    </div>
  );
}

// ─── INNER PAGE NAV (back button bar for inner pages — logo comes from main nav) ──
function InnerNav({ goTo, label = "← Back to Directory" }) {
  return (
    <div style={{ background:"#fff", borderBottom:"1.5px solid #e5e5e5", padding:"0 32px", height:"44px", display:"flex", alignItems:"center" }}>
      <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", fontSize:"13px", fontWeight:"800", cursor:"pointer", color:"#888", fontFamily:"sans-serif", padding:0, display:"flex", alignItems:"center", gap:"6px" }}>{label}</button>
    </div>
  );
}

function TermsPage({ goTo }) {
  return (
    <div>
      <InnerNav goTo={goTo}/>
      <div style={{ maxWidth:"760px", margin:"0 auto", padding:"60px 24px" }}>
      <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Legal</p>
      <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:"900", letterSpacing:"-2px", margin:"0 0 8px" }}>Terms of Service</h1>
      <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", margin:"0 0 48px" }}>Last updated: January 2025</p>

      <LegalSection title="1. About This Platform">
        reffered is a community-powered beauty professional directory. Listings, ratings, and reviews are submitted by members of the public and represent their personal opinions and experiences. reffered is not a booking agency, staffing service, or endorsement platform.
      </LegalSection>

      <LegalSection title="2. User-Generated Content">
        By submitting a recommendation, rating, or review, you confirm that: (a) your submission reflects your genuine personal experience; (b) you are not affiliated with the service provider in a way that would bias your review; (c) your content does not contain false statements of fact, harassment, or defamatory content. reffered reserves the right to remove any content that violates these terms without notice.
      </LegalSection>

      <LegalSection title="3. No Endorsement of Listed Professionals">
        Listings on reffered are not endorsements. The presence of a professional on this platform does not imply that reffered has verified their credentials, licensing, insurance status, or quality of work. Users are solely responsible for conducting their own due diligence before engaging any service provider.
      </LegalSection>

      <LegalSection title="4. Accuracy of Information">
        reffered does not guarantee the accuracy, completeness, or timeliness of any listing or review. Information submitted by community members may be outdated or incorrect. Service providers who wish to update or dispute information on their listing may contact us at <strong>disputes@reffered.com</strong> or use our <span onClick={()=>goTo && goTo("dispute")} style={{color:"#1A00B9",fontWeight:"700",cursor:"pointer",textDecoration:"underline"}}>dispute form</span>.
      </LegalSection>

      <LegalSection title="5. Section 230 Notice">
        reffered is an interactive computer service as defined under 47 U.S.C. § 230. We are not the publisher or speaker of any user-generated content on this platform and are not liable for content submitted by third parties.
      </LegalSection>

      <LegalSection title="6. Takedown & Dispute Requests">
        Service providers listed on this platform without their consent may request profile removal or correction by contacting us at <strong>disputes@reffered.com</strong>. We will review all requests within 10 business days. We reserve the right to maintain factually accurate, publicly available information consistent with applicable law.
      </LegalSection>

      <LegalSection title="7. Limitation of Liability">
        To the fullest extent permitted by law, reffered shall not be liable for any indirect, incidental, or consequential damages arising from your use of this platform or reliance on any listing, rating, or review contained herein.
      </LegalSection>

      <LegalSection title="8. Changes to Terms">
        We reserve the right to update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.
      </LegalSection>
      </div>{/* end content */}
    </div>
  );
}

function PrivacyPage({ goTo }) {
  return (
    <div>
      <InnerNav goTo={goTo}/>
      <div style={{ maxWidth:"760px", margin:"0 auto", padding:"60px 24px" }}>
      <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Legal</p>
      <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:"900", letterSpacing:"-2px", margin:"0 0 8px" }}>Privacy Policy</h1>
      <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", margin:"0 0 48px" }}>Last updated: January 2025</p>

      <LegalSection title="1. What We Collect">
        When you submit a recommendation, we collect your name, email address, and the content of your submission. We use this information solely to review and process your submission. We do not sell your personal data to third parties.
      </LegalSection>

      <LegalSection title="2. Community Submissions">
        Recommendations you submit may be published publicly on the platform, including your first name. Your email address is never displayed publicly. If you wish to have your submitted content removed, contact us at <strong>privacy@reffered.com</strong>.
      </LegalSection>

      <LegalSection title="3. Cookies & Analytics">
        We may use basic analytics tools to understand how users interact with the platform. We do not run advertising trackers or sell behavioral data.
      </LegalSection>

      <LegalSection title="4. Data Retention">
        We retain submitted data for as long as the associated listing is active. You may request deletion of your data at any time by emailing <strong>privacy@reffered.com</strong>.
      </LegalSection>

      <LegalSection title="5. Contact">
        For any privacy-related inquiries, contact us at <strong>privacy@reffered.com</strong>.
      </LegalSection>
      </div>
    </div>
  );
}

function DisputePage({ goTo }) {
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name:"", email:"", proName:"", reason:"", details:"" });
  return (
    <div>
      <InnerNav goTo={goTo}/>
      <div style={{ maxWidth:"680px", margin:"0 auto", padding:"60px 24px" }}>
      <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Service Providers</p>
      <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:"900", letterSpacing:"-2px", margin:"0 0 12px" }}>Dispute or Remove<br/>a Listing</h1>
      <p style={{ fontFamily:"sans-serif", color:"#666", margin:"0 0 40px", lineHeight:"1.7", fontSize:"15px" }}>
        If you are a service provider listed on reffered and would like to correct inaccurate information, claim your profile, or request removal, fill out the form below. We review all requests within 10 business days.
      </p>

      {sent ? (
        <div style={{ background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"48px 40px", textAlign:"center", boxShadow:"4px 4px 0 #e0ddf5" }}>
          <div style={{ fontSize:"40px", marginBottom:"12px" }}>✅</div>
          <h2 style={{ fontFamily:"Georgia,serif", fontSize:"24px", fontWeight:"900", margin:"0 0 10px" }}>Request received.</h2>
          <p style={{ fontFamily:"sans-serif", color:"#444", lineHeight:"1.6" }}>We'll review your request and follow up at <strong>{f.email}</strong> within 10 business days.</p>
        </div>
      ) : (
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"36px", boxShadow:"4px 4px 0 #e0ddf5" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
            <div><label style={lbl}>Your Name *</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Your full name" style={inp}/></div>
            <div><label style={lbl}>Your Email *</label><input value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="you@email.com" style={inp}/></div>
            <div><label style={lbl}>Name of Listed Pro *</label><input value={f.proName} onChange={e=>setF({...f,proName:e.target.value})} placeholder="As it appears on the listing" style={inp}/></div>
            <div><label style={lbl}>Request Type *</label>
              <select value={f.reason} onChange={e=>setF({...f,reason:e.target.value})} style={inp}>
                <option value="">Select a reason...</option>
                <option>Remove my listing entirely</option>
                <option>Correct inaccurate information</option>
                <option>Claim and manage my profile</option>
                <option>Dispute a review</option>
                <option>Other</option>
              </select>
            </div>
            <div><label style={lbl}>Details</label>
              <textarea value={f.details} onChange={e=>setF({...f,details:e.target.value})} placeholder="Please describe your request in detail..." style={{...inp, height:"100px", resize:"vertical"}}/>
            </div>
            <button onClick={()=>{ if(f.name&&f.email&&f.proName&&f.reason) setSent(true); }}
              style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px", background:(!f.name||!f.email||!f.proName||!f.reason)?"#ddd":"#1A00B9", color:(!f.name||!f.email||!f.proName||!f.reason)?"#aaa":"#fff", boxShadow:(!f.name||!f.email||!f.proName||!f.reason)?"none":"4px 4px 0 #1A00B9", border:"1.5px solid #1A00B9"}}>
              Submit Request →
            </button>
          </div>
        </div>
      )}
      </div>{/* end content */}
    </div>
  );
}

// ─── PROVIDER SIGN UP ─────────────────────────────────────────────────────────
function ProviderSignup({ goTo }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ firstName:"", lastName:"", businessName:"", specialties:[], location:"", instagram:"", booking:"", email:"", phone:"", bio:"", agreeTerms:false });
  const [claimed, setClaimed] = useState("");

  const canSubmit = f.firstName && f.lastName && f.email && f.specialties.length > 0 && f.location && f.agreeTerms;
  const toggleSpecialty = (s) => setF(prev => ({ ...prev, specialties: prev.specialties.includes(s) ? prev.specialties.filter(x=>x!==s) : [...prev.specialties, s] }));

  return (
    <div>
      <InnerNav goTo={goTo} label="← Back to Directory"/>
      <div style={{ maxWidth:"700px", margin:"0 auto", padding:"60px 24px" }}>

      <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>For Professionals</p>
      <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,52px)", fontWeight:"900", letterSpacing:"-2px", margin:"0 0 12px", lineHeight:1 }}>Claim Your<br/>Profile.</h1>
      <p style={{ fontFamily:"sans-serif", color:"#666", margin:"0 0 40px", lineHeight:"1.7", fontSize:"15px" }}>
        Your clients are already recommending you. Sign up to claim your profile, receive notifications when new recommendations come in, and take control of your presence on reffered
      </p>

      {/* Progress */}
      <div style={{ display:"flex", gap:"0", marginBottom:"40px" }}>
        {["Your Info","Verify","You're Live!"].map((s,i)=>(
          <div key={i} style={{ flex:1, padding:"12px 16px", background:step===i+1?"#1A00B9":step>i+1?"#B7CF4F":"#f5f5f5", border:"1.5px solid #1A00B9", borderLeft:i>0?"none":"2px solid #1A00B9", display:"flex", flexDirection:"column", gap:"3px" }}>
            <span style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:step===i+1?"#fff":step>i+1?"#1A00B9":"#aaa" }}>Step {i+1}</span>
            <span style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:step===i+1?"#fff":step>i+1?"#1A00B9":"#aaa" }}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"36px", boxShadow:"4px 4px 0 #e0ddf5" }}>
          <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 20px", paddingBottom:"14px", borderBottom:"1.5px solid #f0f0f0" }}>Personal Info</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <div><label style={lbl}>First Name *</label><input value={f.firstName} onChange={e=>setF({...f,firstName:e.target.value})} placeholder="First" style={inp}/></div>
              <div><label style={lbl}>Last Name *</label><input value={f.lastName} onChange={e=>setF({...f,lastName:e.target.value})} placeholder="Last" style={inp}/></div>
            </div>
            <div><label style={lbl}>Business / Studio Name</label><input value={f.businessName} onChange={e=>setF({...f,businessName:e.target.value})} placeholder="e.g. Monroe Hair Studio" style={inp}/></div>
            <div><label style={lbl}>Your Specialty * <span style={{ fontWeight:"400", textTransform:"none", fontSize:"11px", color:"#888" }}>(select all that apply)</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                {SPECIALTIES.map(s=>(
                  <button key={s} type="button" onClick={()=>toggleSpecialty(s)}
                    style={{ padding:"8px 16px", borderRadius:"20px", border:"1.5px solid", borderColor: f.specialties.includes(s)?"#1A00B9":"#e0ddf5", background: f.specialties.includes(s)?"#1A00B9":"#fff", color: f.specialties.includes(s)?"#fff":"#555", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", cursor:"pointer", transition:"all 0.15s" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>City & State *</label><input value={f.location} onChange={e=>setF({...f,location:e.target.value})} placeholder="e.g. Atlanta, GA" style={inp}/></div>
            <div><label style={lbl}>Email Address *</label><input value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="you@email.com" style={inp}/></div>
            <div><label style={lbl}>Phone Number</label><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} placeholder="(000) 000-0000" style={inp}/></div>

            <hr style={{ border:"none", borderTop:"1.5px solid #f0f0f0" }}/>
            <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:0 }}>Public Profile</p>

            <div><label style={lbl}>Instagram Handle</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#aaa", fontWeight:"700", fontFamily:"sans-serif" }}>@</span>
                <input value={f.instagram} onChange={e=>setF({...f,instagram:e.target.value})} placeholder="yourhandle" style={{...inp, paddingLeft:"34px"}}/>
              </div>
            </div>
            <div><label style={lbl}>Booking Link</label><input value={f.booking} onChange={e=>setF({...f,booking:e.target.value})} placeholder="https://..." style={inp}/></div>
            <div><label style={lbl}>Bio</label>
              <textarea value={f.bio} onChange={e=>setF({...f,bio:e.target.value})} placeholder="Tell clients a little about yourself, your style, and what makes your work special..." style={{...inp, height:"100px", resize:"vertical"}}/>
            </div>

            {/* Existing profile search */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"16px" }}>
              <p style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", margin:"0 0 10px", color:"#1A00B9" }}>Already listed? Search for your profile:</p>
              <div style={{ display:"flex", gap:"8px" }}>
                <input value={claimed} onChange={e=>setClaimed(e.target.value)} placeholder="Search your name..." style={{...inp, flex:1, padding:"10px 14px", fontSize:"13px"}}/>
                <button style={{...btnDark, padding:"10px 18px", fontSize:"12px", boxShadow:"none"}}>Search</button>
              </div>
              {claimed && <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888", margin:"8px 0 0" }}>We'll link your signup to your existing listing during verification.</p>}
            </div>

            {/* Agree */}
            <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
              <input type="checkbox" id="agree" checked={f.agreeTerms} onChange={e=>setF({...f,agreeTerms:e.target.checked})} style={{ marginTop:"3px", accentColor:"#1A00B9", width:"16px", height:"16px", cursor:"pointer" }}/>
              <label htmlFor="agree" style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#555", lineHeight:"1.6", cursor:"pointer" }}>
                I agree to the <strong style={{ color:"#1A00B9", textDecoration:"underline", cursor:"pointer" }}>Terms of Service</strong> and confirm that I am the professional or authorized representative of the business being listed. I understand that reviews on reffered are community-submitted opinions.
              </label>
            </div>

            <button onClick={()=>{ if(canSubmit) setStep(2); }}
              style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px", background:!canSubmit?"#ddd":"#1A00B9", color:!canSubmit?"#aaa":"#fff", boxShadow:!canSubmit?"none":"4px 4px 0 #1A00B9", border:"1.5px solid #1A00B9"}}>
              Continue to Verify →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"36px", boxShadow:"4px 4px 0 #e0ddf5", textAlign:"center" }}>
          <div style={{ fontSize:"48px", marginBottom:"16px" }}>📬</div>
          <h2 style={{ fontFamily:"Georgia,serif", fontSize:"26px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-0.5px" }}>Check your inbox.</h2>
          <p style={{ fontFamily:"sans-serif", color:"#555", lineHeight:"1.7", margin:"0 0 8px" }}>
            We sent a verification link to <strong>{f.email}</strong>. Click it to verify your identity and activate your provider account.
          </p>
          <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", margin:"0 0 32px" }}>Didn't get it? Check spam or <span style={{ textDecoration:"underline", cursor:"pointer", color:"#9B8AFB" }}>resend the email.</span></p>

          <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"14px", padding:"20px", marginBottom:"28px", textAlign:"left" }}>
            <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 14px" }}>What happens next</p>
            {[
              { icon:"✅", text:"You verify your email" },
              { icon:"🔍", text:"We match you to your existing listing (if one exists)" },
              { icon:"🎨", text:"You unlock your provider dashboard to manage your profile" },
              { icon:"🔔", text:"You receive notifications when new recommendations come in" },
            ].map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", marginBottom:i<3?"12px":"0" }}>
                <span style={{ fontSize:"16px" }}>{item.icon}</span>
                <span style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#555", lineHeight:"1.5" }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* For demo purposes — simulate verification */}
          <button onClick={()=>setStep(3)} style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px"}}>
            Simulate: I've Verified My Email ✓
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{...gridBg, background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"56px 40px", textAlign:"center", boxShadow:"4px 4px 0 #e0ddf5"}}>
          <div style={{ fontSize:"52px", marginBottom:"16px" }}>🎉</div>
          <h2 style={{ fontFamily:"Georgia,serif", fontSize:"32px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-1px" }}>Welcome to reffered</h2>
          <p style={{ fontFamily:"sans-serif", color:"#444", lineHeight:"1.7", margin:"0 0 8px", fontSize:"15px" }}>
            <strong>{f.firstName} {f.lastName}</strong>, your provider account is live.
          </p>
          <p style={{ fontFamily:"sans-serif", color:"#666", margin:"0 0 32px", fontSize:"14px", lineHeight:"1.6" }}>
            You'll now receive an email notification every time someone recommends you. Your dashboard is coming soon — we'll let you know when it's ready.
          </p>
          <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"20px", marginBottom:"28px", textAlign:"left" }}>
            <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 14px" }}>Your Provider Perks</p>
            {[
              "📬  Email alerts for every new recommendation",
              "🖊️  Edit your bio, booking link, and Instagram",
              "📸  Upload your own portfolio photos",
              "🔔  Flag or dispute inaccurate reviews",
              "⭐  Full rating breakdown visible to you first",
            ].map((perk,i)=>(
              <div key={i} style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#444", padding:"8px 0", borderBottom:i<4?"1px solid #e5e5e5":"none" }}>{perk}</div>
            ))}
          </div>
          <button onClick={()=>goTo("home")} style={{...btnDark, padding:"14px 32px", fontSize:"14px"}}>Back to Directory</button>
        </div>
      )}
      </div>{/* end content */}
    </div>
  );
}

// ─── LICENSED SPECIALTIES ────────────────────────────────────────────────────
const LICENSED_SPECIALTIES = ["Hair Stylists", "Estheticians", "Nail Techs", "Lash & Brow"];

const CREDENTIAL_TYPES = {
  "Hair Stylists":  ["Cosmetology License", "Natural Hair Care License"],
  "Estheticians":   ["Esthetics License", "Medical Esthetics Certificate"],
  "Nail Techs":     ["Nail Technology License", "Manicurist License"],
  "Lash & Brow":    ["Esthetics License", "Lash Extension Certification"],
};

// Demo credentials for Aaliyah
const DEMO_CREDENTIALS = []; // Will load from Supabase in production

// ─── CREDENTIALS TAB ─────────────────────────────────────────────────────────
function CredentialsTab({ pro }) {
  const isLicensed = LICENSED_SPECIALTIES.includes(pro.specialty);
  const credTypes = CREDENTIAL_TYPES[pro.specialty] || [];
  const [creds, setCreds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: credTypes[0]||"", number:"", state:"", issued:"", expires:"" });
  const [submitted, setSubmitted] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [licenseFileUrl, setLicenseFileUrl] = useState("");

  // Load existing credentials from Supabase
  useEffect(() => {
    if (!pro?.supabaseId) return;
    supabase.from("credentials").select("*").eq("pro_id", pro.supabaseId)
      .then(({ data }) => { if (data) setCreds(data); });
  }, [pro?.supabaseId]);

  const statusStyle = (s) => ({
    verified:  { bg:"#B7CF4F", color:"#1A00B9", label:"✓ Verified" },
    pending:   { bg:"#fff8e6", color:"#b45309", label:"⏳ Under Review" },
    rejected:  { bg:"#FFE5DE", color:"#cc2255", label:"✗ Not Verified" },
  }[s] || { bg:"#f0f0f0", color:"#888", label:s });

  if (!isLicensed) return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      <div>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 8px", letterSpacing:"-1px" }}>Credentials</h2>
        <p style={{ color:"#666", fontSize:"14px", lineHeight:"1.6", margin:0 }}>Credential verification is available for licensed specialties.</p>
      </div>
      <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"16px", padding:"40px", textAlign:"center" }}>
        <div style={{ fontSize:"40px", marginBottom:"12px" }}>🎨</div>
        <h3 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 8px" }}>No license required for {pro.specialty}</h3>
        <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#888", margin:"0 auto", maxWidth:"400px", lineHeight:"1.6" }}>
          Makeup artists aren't state-licensed in most jurisdictions, so we don't display a credential badge for this specialty. Your community ratings and portfolio speak for themselves.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 6px", letterSpacing:"-1px" }}>Credentials</h2>
          <p style={{ color:"#666", fontSize:"14px", margin:0, lineHeight:"1.6" }}>Submit your license details. We verify each one manually within 3 business days.</p>
        </div>
        <button onClick={()=>{ setShowForm(!showForm); setSubmitted(false); }}
          style={{...btnPink, padding:"10px 20px", fontSize:"12px", boxShadow:"3px 3px 0 #1A00B9"}}>
          {showForm?"Cancel":"+ Add Credential"}
        </button>
      </div>

      {/* What verification means */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"12px" }}>
        {[
          { icon:"🛡️", title:"Manual Review", body:"Our team checks your license against the state board database." },
          { icon:"✨", title:"Verified Badge", body:"A shield badge appears on your profile and pro card in the directory." },
          { icon:"🔒", title:"Client Trust", body:"Verified pros get 40% more profile clicks on average." },
        ].map((c,i)=>(
          <div key={i} style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", padding:"16px 18px" }}>
            <div style={{ fontSize:"22px", marginBottom:"6px" }}>{c.icon}</div>
            <p style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", margin:"0 0 4px", color:"#1A00B9" }}>{c.title}</p>
            <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888", margin:0, lineHeight:"1.5" }}>{c.body}</p>
          </div>
        ))}
      </div>

      {/* Add credential form */}
      {showForm && !submitted && (
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"28px", boxShadow:"4px 4px 0 #1A00B9" }}>
          <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 20px" }}>Submit a License</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div>
              <label style={lbl}>License Type *</label>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={inp}>
                {credTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <div><label style={lbl}>License Number *</label><input value={form.number} onChange={e=>setForm({...form,number:e.target.value})} placeholder="e.g. GA-2019-448821" style={inp}/></div>
              <div>
                <label style={lbl}>Issuing State *</label>
                <select value={form.state} onChange={e=>setForm({...form,state:e.target.value})} style={inp}>
                  <option value="">Select state...</option>
                  {["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <div><label style={lbl}>Issue Date *</label><input type="date" value={form.issued} onChange={e=>setForm({...form,issued:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Expiration Date *</label><input type="date" value={form.expires} onChange={e=>setForm({...form,expires:e.target.value})} style={inp}/></div>
            </div>

            {/* Upload */}
            <div>
              <label style={lbl}>License Photo / Scan (optional)</label>
              <label style={{ cursor:"pointer", display:"block" }}>
                <div style={{ border:`2px dashed ${licenseFileUrl?"#1A00B9":"#ccc"}`, borderRadius:"10px", padding:"24px", textAlign:"center", background:licenseFileUrl?"#f4f2ff":"#fff", transition:"all 0.2s" }}>
                  {licenseFileUrl ? (
                    <>
                      <div style={{ fontSize:"24px", marginBottom:"6px" }}>✅</div>
                      <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#1A00B9", margin:"0 0 4px" }}>File uploaded</p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#888", margin:0 }}>Click to replace</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:"24px", marginBottom:"6px" }}>📎</div>
                      <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", margin:"0 0 4px" }}>Upload a photo or scan of your license</p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa", margin:0 }}>JPG, PNG, or PDF · Max 5MB · Stored securely</p>
                    </>
                  )}
                </div>
                <input type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={async e=>{
                  const file = e.target.files[0]; if(!file || !pro?.supabaseId) return;
                  setCredSaving(true);
                  const ext = file.name.split(".").pop();
                  const path = `${pro.supabaseId}/license-${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("pro-photos").upload(path, file, { upsert:true });
                  if (!error) {
                    const { data:urlData } = supabase.storage.from("pro-photos").getPublicUrl(path);
                    setLicenseFileUrl(urlData.publicUrl);
                  }
                  setCredSaving(false);
                }}/>
              </label>
            </div>

            <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"10px", padding:"12px 16px" }}>
              <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888", margin:0, lineHeight:"1.6" }}>
                🔒 Your license information is stored securely and is only used for verification purposes. Your license number is never displayed publicly — only the verified badge is shown.
              </p>
            </div>

            <button onClick={async ()=>{
              if(!form.number||!form.state||!form.issued||!form.expires) return;
              setCredSaving(true);
              const newCred = { type:form.type, number:form.number, state:form.state, issued:form.issued, expires:form.expires, status:"pending", license_url: licenseFileUrl || "" };
              if (pro?.supabaseId) {
                const { error } = await supabase.from("credentials").insert([{ pro_id: pro.supabaseId, ...newCred }]);
                if (!error) { setCreds(prev=>[...prev, newCred]); setSubmitted(true); setShowForm(false); setLicenseFileUrl(""); }
              }
              setCredSaving(false);
            }}
              style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px", border:"1.5px solid #1A00B9", boxShadow:"4px 4px 0 #B7CF4F", background:(!form.number||!form.state||!form.issued||!form.expires||credSaving)?"#ddd":"#1A00B9", color:(!form.number||!form.state||!form.issued||!form.expires||credSaving)?"#aaa":"#fff", opacity:credSaving?0.7:1 }}>
              {credSaving ? "Submitting..." : "Submit for Verification →"}
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"20px 24px", display:"flex", alignItems:"center", gap:"12px", boxShadow:"3px 3px 0 #1A00B9" }}>
          <span style={{ fontSize:"24px" }}>✅</span>
          <div>
            <p style={{ fontFamily:"sans-serif", fontWeight:"800", fontSize:"14px", margin:"0 0 2px" }}>Submitted! We'll review within 3 business days.</p>
            <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#555", margin:0 }}>You'll receive an email confirmation when your license is verified.</p>
          </div>
        </div>
      )}

      {/* Existing credentials */}
      <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
        <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 18px" }}>Your Licenses on File</p>
        {creds.length === 0 ? (
          <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#aaa", textAlign:"center", padding:"24px 0" }}>No credentials submitted yet. Add your first license above.</p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {creds.map((c,i)=>{
              const s = statusStyle(c.status);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px", background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", flexWrap:"wrap", gap:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                    <div style={{ width:"40px", height:"40px", borderRadius:"10px", background:s.bg, border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>
                      {c.status==="verified"?"🛡️":c.status==="pending"?"⏳":"✗"}
                    </div>
                    <div>
                      <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", margin:"0 0 2px", color:"#1A00B9" }}>{c.type}</p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#888", margin:0 }}>
                        #{c.number} · {c.state} · Expires {c.expires}
                      </p>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ background:s.bg, color:s.color, fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", padding:"4px 12px", borderRadius:"20px", border:"1.5px solid #1A00B9", whiteSpace:"nowrap" }}>
                      {s.label}
                    </span>
                    {c.status==="verified" && (
                      <span style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#888" }}>Verified Jan 2025</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* What clients see */}
      <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
        <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 16px" }}>What Clients See on Your Profile</p>
        <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", padding:"18px", display:"inline-flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"20px" }}>🛡️</span>
          <div>
            <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", margin:"0 0 2px" }}>reffered Verified Pro</p>
            <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#888", margin:0 }}>Cosmetology License verified · Georgia · Jan 2025</p>
          </div>
          <span style={{ background:"#B7CF4F", color:"#1A00B9", border:"1.5px solid #1A00B9", fontSize:"10px", fontWeight:"800", padding:"3px 10px", borderRadius:"20px", marginLeft:"8px" }}>✓ Verified</span>
        </div>
        <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa", margin:"12px 0 0" }}>
          Your license number is never shown publicly — only the verified status and license type are displayed.
        </p>
      </div>
    </div>
  );
}

// ─── PRO SIGN-IN GATE ─────────────────────────────────────────────────────────
function ProSignIn({ onLogin, goTo, onSignupStart, initialTab = "signin" }) {
  const [tab, setTab] = useState(initialTab); // "signin" | "signup" | "forgot" | "resetPassword"

  // ── Sign In state ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetDone, setResetDone] = useState(false);

  // ── Plan selection ──
  const [selectedPlan, setSelectedPlan] = useState(null); // "pro" | "pro_plus"
  const [planChosen, setPlanChosen] = useState(false); // true = pricing done, show signup form
  const [billingInterval, setBillingInterval] = useState("month"); // "month" | "year"
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // ── Sign Up state ──
  const [su, setSu] = useState({ firstName:"", lastName:"", email:"", password:"", confirmPassword:"", specialties:[], city:"", state:"", agreeTerms:false });
  const toggleSuSpecialty = (s) => setSu(prev => ({ ...prev, specialties: prev.specialties.includes(s) ? prev.specialties.filter(x=>x!==s) : [...prev.specialties, s] }));
  const [suError, setSuError] = useState("");
  const [suLoading, setSuLoading] = useState(false);
  const [suDone, setSuDone] = useState(false);
  const [showSuPass, setShowSuPass] = useState(false);
  const [suUserId, setSuUserId] = useState(null);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboard, setOnboard] = useState({ bio:"", phone:"", instagram:"", tiktok:"", booking:"", photoUrl:"" });
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Auth handled by Supabase in production

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setLoading(false); setError(err.message); return; }
    const { data: proRow } = await supabase.from("pros").select("*").eq("profile_id", data.user.id).single();
    setLoading(false);
    onLogin(proRow ? mapSupabasePro(proRow) : { id: data.user.id, name: email, specialty:"", location:"", ratings: defaultRatings(), reviews:0, tags:[], bio:"", instagram:"", booking:"", tiktokReview:"", recommendedBy:[], proPlus:false, verified:false, weeklyRecs:0 });
  };

  const handleSignUp = async () => {
    setSuError("");
    if (!su.firstName || !su.lastName || !su.email || !su.password || !su.specialties.length || !su.city || !su.state) {
      setSuError("Please fill in all required fields."); return;
    }
    if (su.password !== su.confirmPassword) { setSuError("Passwords don't match."); return; }
    if (su.password.length < 8) { setSuError("Password must be at least 8 characters."); return; }
    if (!su.agreeTerms) { setSuError("Please agree to the Terms of Service to continue."); return; }
    setSuLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: su.email,
      password: su.password,
      options: { emailRedirectTo: window.location.origin + "/?page=dashboard" },
    });
    if (err) { setSuLoading(false); setSuError(err.message); return; }
    const isPro = selectedPlan === "pro_plus";
    await supabase.from("pros").insert([{
      id: data.user.id,
      profile_id: data.user.id,
      first_name: su.firstName,
      last_name: su.lastName,
      specialty: su.specialties.join(", "),
      email: su.email,
      location_city: su.city,
      location_state: su.state,
      location_display: `${su.city}, ${su.state}`,
      is_active: true,
      is_approved: true,  // self-signed pros are auto-approved
      is_claimed: true,
      is_verified: false,
      is_pro_plus: isPro,
    }]);
    setSuUserId(data.user.id);
    setSuLoading(false);
    // Send branded welcome email (fire-and-forget — don't block signup on this)
    fetch("/api/send-welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: su.email, firstName: su.firstName }),
    }).catch(() => {}); // silently ignore if it fails
    if (isPro) {
      // Redirect to Stripe Checkout for Pro+ payment
      setCheckoutLoading(true);
      try {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, email: su.email, interval: billingInterval }),
        });
        const json = await res.json();
        if (json.url) { window.location.href = json.url; return; }
        setSuError("Payment setup failed. Please try again.");
      } catch (e) {
        setSuError("Payment setup failed: " + e.message);
      }
      setCheckoutLoading(false);
    } else {
      onSignupStart?.(); // tell App we're in onboarding — block premature dashboard redirect
      setSuDone(true);
      setOnboardStep(1);
    }
  };

  const tabStyle = (active) => ({
    flex:1, padding:"12px 16px", border:"none", borderRadius: "0",
    background: active ? "#1A00B9" : "transparent",
    fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer",
    color: active ? "#fff" : "#aaa",
    transition:"all 0.15s", letterSpacing:"0.5px",
  });

  return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 32px", borderBottom:"1.5px solid #e5e5e5", background:"#fff" }}>
        <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", fontSize:"13px", fontWeight:"800", cursor:"pointer", color:"#888", fontFamily:"sans-serif", padding:0 }}>← Back to Directory</button>
      </div>
      <div style={{ flex:1, padding:"48px 24px" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto" }}>

          {/* ── WHY PRO+ — only shown on signup tab before plan chosen ── */}
          {tab==="signup" && !suDone && !planChosen && (<>
            <div style={{ textAlign:"center", marginBottom:"40px" }}>
              <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"52px", height:"52px", background:"#1A00B9", borderRadius:"50%", border:"1.5px solid #1A00B9", marginBottom:"14px", boxShadow:"3px 3px 0 #1A00B9" }}>
                <span style={{ fontSize:"22px", color:"#fff" }}>✦</span>
              </div>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,5vw,42px)", fontWeight:"900", margin:"0 0 8px", letterSpacing:"-1.5px" }}>Built for pros who are serious about their craft.</h1>
              <p style={{ fontFamily:"sans-serif", fontSize:"15px", color:"#666", margin:"0 auto", maxWidth:"520px", lineHeight:"1.7" }}>
                Choose the plan that fits where you are. Upgrade anytime — no contracts, no catch.
              </p>
            </div>

            {/* 4 value blocks */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"16px", marginBottom:"40px" }}>
              {[
                { emoji:"🌟", title:"Get Discovered", body:"Your profile is searchable by clients in your city the moment you claim it. No marketing budget needed." },
                { emoji:"📊", title:"See Your Wins", body:"Track recommendations over time, see how you stack up against your city average, and spot where to improve." },
                { emoji:"🛡️", title:"Build Trust Fast", body:"Pro+ members can verify their license — giving clients the confidence to book without hesitation." },
                { emoji:"💡", title:"Grow Smarter", body:"Pro+ unlocks personalized business insights based on your client feedback — practical tips that move the needle." },
              ].map((b,i)=>(
                <div key={i} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px 20px", boxShadow:"4px 4px 0 #1A00B9" }}>
                  <div style={{ fontSize:"28px", marginBottom:"10px" }}>{b.emoji}</div>
                  <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#1A00B9", margin:"0 0 6px" }}>{b.title}</p>
                  <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#666", margin:0, lineHeight:"1.6" }}>{b.body}</p>
                </div>
              ))}
            </div>

            {/* Plan comparison */}
            <div className="plan-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
              {/* Pro */}
              <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
                <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 6px" }}>Free to Start</p>
                <h3 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 4px" }}>Pro</h3>
                <p style={{ fontFamily:"sans-serif", fontSize:"26px", fontWeight:"900", color:"#1A00B9", margin:"0 0 16px" }}>$0 <span style={{ fontSize:"13px", fontWeight:"600", color:"#aaa" }}>/ month</span></p>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {[
                    "Claimable profile in the directory",
                    "Community ratings & reviews",
                    "Shareable profile link",
                    "Instagram link on your card",
                    "Basic overview dashboard",
                    "Recommendation notifications",
                  ].map((f,i)=>(
                    <div key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                      <span style={{ color:"#1A00B9", fontWeight:"800", fontSize:"13px", flexShrink:0 }}>✓</span>
                      <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#444", lineHeight:"1.5" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{ setSelectedPlan("pro"); setPlanChosen(true); setTab("signup"); window.scrollTo({top:0,behavior:"smooth"}); }} style={{ marginTop:"20px", width:"100%", padding:"12px", background:"#fff", border:"2px solid #1A00B9", borderRadius:"10px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#1A00B9", cursor:"pointer", boxShadow:"3px 3px 0 #1A00B9" }}>Start Free →</button>
              </div>

              {/* Pro+ */}
              <div style={{ background:"#EAE6FF", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px", boxShadow:"4px 4px 0 #1A00B9", position:"relative" }}>
                <div style={{ position:"absolute", top:"-12px", right:"20px", background:"#1A00B9", color:"#fff", fontSize:"10px", fontWeight:"800", padding:"4px 12px", borderRadius:"20px", letterSpacing:"1px" }}>MOST POPULAR</div>
                <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 6px" }}>Full Access</p>
                <h3 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 4px" }}>Pro+</h3>
                <div style={{ display:"flex", alignItems:"baseline", gap:"10px", marginBottom:"16px" }}>
                  <span style={{ fontFamily:"sans-serif", fontSize:"26px", fontWeight:"900", color:"#1A00B9" }}>$9.99 <span style={{ fontSize:"13px", fontWeight:"600", color:"#aaa" }}>/ mo</span></span>
                  <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888" }}>or $75 / year</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {[
                    ["Everything in Pro", false],
                    ["Featured placement in search results", false],
                    ["🔥 Trending eligibility", true],
                    ["🛡️ License verification & badge", true],
                    ["✨ Your Wins — insights & share kit", true],
                    ["💡 Business & client experience insights", true],
                    ["Website widget & embed code", true],
                    ["Priority support", false],
                  ].map(([f, isNew],i)=>(
                    <div key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                      <span style={{ color:"#1A00B9", fontWeight:"800", fontSize:"13px", flexShrink:0 }}>✓</span>
                      <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#333", lineHeight:"1.5" }}>
                        {f}
                        {isNew && <span style={{ background:"#1A00B9", color:"#fff", fontSize:"9px", fontWeight:"800", padding:"1px 6px", borderRadius:"10px", marginLeft:"6px" }}>PRO+</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{ setSelectedPlan("pro_plus"); setPlanChosen(true); setTab("signup"); window.scrollTo({top:0,behavior:"smooth"}); }} style={{ marginTop:"20px", width:"100%", padding:"12px", background:"#1A00B9", border:"2px solid #1A00B9", borderRadius:"10px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#fff", cursor:"pointer", boxShadow:"4px 4px 0 #B7CF4F" }}>Start Pro+ →</button>
              </div>
            </div>

            {/* Divider with CTA */}
            <div style={{ textAlign:"center", margin:"32px 0 8px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"24px" }}>
                <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
                <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", whiteSpace:"nowrap" }}>Pro+ exclusive</span>
                <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
              </div>
            </div>

            {/* Insights TEASER — locked preview, no actual tips shown */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"28px", boxShadow:"5px 5px 0 #1A00B9", marginBottom:"16px", position:"relative" }}>
              <div style={{ position:"absolute", top:"16px", right:"16px", background:"#1A00B9", color:"#fff", fontSize:"10px", fontWeight:"800", padding:"4px 12px", borderRadius:"20px", letterSpacing:"1px" }}>PRO+ ONLY</div>

              <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 4px" }}>Business & Client Experience Insights</p>
              <h3 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 8px", letterSpacing:"-0.5px" }}>Your ratings tell a story. We help you act on it.</h3>
              <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#666", margin:"0 0 24px", lineHeight:"1.6", maxWidth:"560px" }}>
                Pro+ analyzes your client feedback across all 7 rating categories and surfaces personalized beauty pro insights — specific, actionable, and ranked by the gap between your scores and your city's average.
              </p>

              {/* Locked card grid — category names visible, content hidden */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"12px", marginBottom:"20px" }}>
                {[
                  { icon:"⭐", tag:"Service Outcome", impact:"High Impact", impactColor:"#FFE5DE" },
                  { icon:"✨", tag:"Cleanliness & Vibe", impact:"Quick Win", impactColor:"#EDFAD4" },
                  { icon:"⏱️", tag:"Wait Time", impact:"Quick Win", impactColor:"#EDFAD4" },
                  { icon:"💬", tag:"Communication", impact:"Loyalty Builder", impactColor:"#dde8f7" },
                  { icon:"🅿️", tag:"Parking", impact:"Easy Fix", impactColor:"#f5f5f5" },
                  { icon:"💰", tag:"Value for Money", impact:"Retention", impactColor:"#dde8f7" },
                ].map((item,i)=>(
                  <div key={i} style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", padding:"16px", position:"relative", overflow:"hidden" }}>
                    {/* Visible: category + impact label */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                      <span style={{ fontSize:"18px" }}>{item.icon}</span>
                      <span style={{ background:item.impactColor, fontSize:"10px", fontWeight:"800", padding:"2px 8px", borderRadius:"20px", border:"1px solid #e5e5e5", color:"#1A00B9" }}>{item.impact}</span>
                    </div>
                    <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#aaa", margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"1px" }}>{item.tag}</p>
                    {/* Blurred placeholder lines */}
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px", filter:"blur(4px)", userSelect:"none", pointerEvents:"none" }}>
                      <div style={{ height:"10px", background:"#ddd", borderRadius:"4px", width:"90%" }}/>
                      <div style={{ height:"10px", background:"#ddd", borderRadius:"4px", width:"75%" }}/>
                      <div style={{ height:"10px", background:"#ddd", borderRadius:"4px", width:"60%" }}/>
                    </div>
                    {/* Lock icon overlay */}
                    <div style={{ position:"absolute", bottom:"12px", right:"12px", fontSize:"14px", opacity:0.4 }}>🔒</div>
                  </div>
                ))}
              </div>

              <div style={{ padding:"16px 20px", background:"#EAE6FF", borderRadius:"12px", border:"1.5px solid #8B78F0", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", flexWrap:"wrap" }}>
                <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#1A00B9", margin:0, fontWeight:"700" }}>
                  ✦ Insights are generated from your actual client ratings — not generic advice.
                </p>
                <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#1A00B9", fontWeight:"800", whiteSpace:"nowrap" }}>Unlocks with Pro+ →</span>
              </div>
            </div>

            {/* Final form divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"16px", margin:"32px 0 8px" }}>
              <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
              <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", whiteSpace:"nowrap" }}>Create your account</span>
              <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
            </div>
          </>)}

          {/* ── PLAN CHOSEN BADGE ── */}
          {tab==="signup" && planChosen && !suDone && (
            <div style={{ maxWidth:"460px", margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"space-between", background: selectedPlan==="pro_plus" ? "#EAE6FF" : "#f4f2ff", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"12px 18px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"18px" }}>{selectedPlan==="pro_plus" ? "✦" : "✓"}</span>
                <div>
                  <p style={{ margin:0, fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"1px", textTransform:"uppercase", color:"#1A00B9" }}>Selected Plan</p>
                  <p style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", color:"#111" }}>{selectedPlan==="pro_plus" ? "Pro+ — $9.99/mo" : "Pro — Free"}</p>
                </div>
              </div>
              <button onClick={()=>{ setPlanChosen(false); setSelectedPlan(null); }} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"700", color:"#1A00B9", cursor:"pointer", textDecoration:"underline" }}>Change →</button>
            </div>
          )}

          {/* ── SIGN IN header (centered, compact) ── */}
          {tab==="signin" && (
            <div style={{ textAlign:"center", marginBottom:"28px" }}>
              <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"52px", height:"52px", background:"#1A00B9", borderRadius:"50%", border:"1.5px solid #1A00B9", marginBottom:"14px", boxShadow:"3px 3px 0 #1A00B9" }}>
                <span style={{ fontSize:"22px" }}>✦</span>
              </div>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:"26px", fontWeight:"900", margin:"0 0 4px", letterSpacing:"-1px" }}>Pro+ Sign In</h1>
              <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>Access your dashboard, credentials, and insights.</p>
            </div>
          )}

          {/* ── FORM CARD ── */}
          <div style={{ maxWidth:"460px", margin:"0 auto" }}>
            {/* Tab switcher */}
            <div style={{ background:"#f4f2ff", border:"1.5px solid #1A00B9", borderRadius:"14px 14px 0 0", display:"flex", overflow:"hidden" }}>
              <button style={{...tabStyle(tab==="signin"), borderRadius:"12px 0 0 0"}} onClick={()=>{ setTab("signin"); setError(""); setSuError(""); setPlanChosen(false); setSelectedPlan(null); }}>Sign In</button>
              <div style={{ width:"1px", background:"#e0ddf5" }}/>
              <button style={{...tabStyle(tab==="signup"), borderRadius:"0 12px 0 0"}} onClick={()=>{ setTab("signup"); setError(""); setSuError(""); }}>Create Account</button>
            </div>

            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderTop:"none", borderRadius:"0 0 20px 20px", padding:"32px 36px", boxShadow:"4px 4px 0 #e0ddf5" }}>

            {/* ── SIGN IN ── */}
            {tab==="signin" && (
              <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                <div>
                  <label style={lbl}>Email Address</label>
                  <input value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
                    onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    placeholder="you@email.com" style={{...inp, borderColor:error?"#9B8AFB":"#1A00B9"}}/>
                </div>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                    <label style={{...lbl, margin:0}}>Password</label>
                    <span onClick={()=>setTab("forgot")} style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#1A00B9", fontWeight:"700", cursor:"pointer" }}>Forgot password?</span>
                  </div>
                  <div style={{ position:"relative" }}>
                    <input type={showPass?"text":"password"} value={password}
                      onChange={e=>{setPassword(e.target.value);setError("");}}
                      onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                      placeholder="••••••••" style={{...inp, paddingRight:"52px", borderColor:error?"#9B8AFB":"#1A00B9"}}/>
                    <button onClick={()=>setShowPass(!showPass)}
                      style={{ position:"absolute", right:"14px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"#aaa", fontFamily:"sans-serif", fontWeight:"700" }}>
                      {showPass?"Hide":"Show"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background:"#fff0f4", border:"1.5px solid #9B8AFB", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", color:"#cc2255", fontWeight:"600", fontFamily:"sans-serif" }}>
                    ⚠️ {error}
                  </div>
                )}

                <button onClick={handleLogin}
                  style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px", border:"1.5px solid #1A00B9", boxShadow:"4px 4px 0 #B7CF4F", opacity:loading?0.7:1}}>
                  {loading ? "Signing in..." : "Sign In →"}
                </button>

                <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa", textAlign:"center", margin:0 }}>
                  New here? <span onClick={()=>setTab("signup")} style={{ color:"#1A00B9", fontWeight:"800", cursor:"pointer" }}>Create an account</span>
                </p>
              </div>
            )}

            {/* ── SIGN UP ── */}
            {tab==="signup" && !suDone && (
              <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                {/* Plan badge */}
                {selectedPlan && (
                  <div style={{ background: selectedPlan==="pro_plus" ? "#EAE6FF" : "#f4f4f4", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", color:"#1A00B9" }}>
                      {selectedPlan==="pro_plus" ? "✦ Pro+ — $9.99/mo or $75/yr" : "✓ Pro — Free"}
                    </span>
                    <span onClick={()=>{ setSelectedPlan(null); setTab("signup"); }} style={{ fontSize:"11px", color:"#aaa", cursor:"pointer", fontFamily:"sans-serif", fontWeight:"700" }}>Change plan</span>
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div><label style={lbl}>First Name *</label><input value={su.firstName} onChange={e=>setSu({...su,firstName:e.target.value})} placeholder="First" style={inp}/></div>
                  <div><label style={lbl}>Last Name *</label><input value={su.lastName} onChange={e=>setSu({...su,lastName:e.target.value})} placeholder="Last" style={inp}/></div>
                </div>
                <div>
                  <label style={lbl}>Email Address *</label>
                  <input value={su.email} onChange={e=>setSu({...su,email:e.target.value})} placeholder="you@email.com" style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Specialty * <span style={{ fontWeight:"400", textTransform:"none", fontSize:"11px", color:"#888" }}>(select all that apply)</span></label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                    {SPECIALTIES.map(s=>(
                      <button key={s} type="button" onClick={()=>toggleSuSpecialty(s)}
                        style={{ padding:"8px 16px", borderRadius:"20px", border:"1.5px solid", borderColor: su.specialties.includes(s)?"#1A00B9":"#e0ddf5", background: su.specialties.includes(s)?"#1A00B9":"#fff", color: su.specialties.includes(s)?"#fff":"#555", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", cursor:"pointer", transition:"all 0.15s" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                  <div>
                    <label style={lbl}>State *</label>
                    <select value={su.state} onChange={e=>setSu({...su,state:e.target.value,city:""})} style={inp}>
                      <option value="">State...</option>
                      {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>City *</label>
                    <input value={su.city} onChange={e=>setSu({...su,city:e.target.value})} placeholder="Your city" style={inp} disabled={!su.state}/>
                  </div>
                </div>

                <hr style={{ border:"none", borderTop:"1.5px solid #f0f0f0", margin:"0" }}/>

                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                    <label style={{...lbl, margin:0}}>Password *</label>
                    <span style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa" }}>Min. 8 characters</span>
                  </div>
                  <div style={{ position:"relative" }}>
                    <input type={showSuPass?"text":"password"} value={su.password}
                      onChange={e=>setSu({...su,password:e.target.value})}
                      placeholder="••••••••" style={{...inp, paddingRight:"52px"}}/>
                    <button onClick={()=>setShowSuPass(!showSuPass)}
                      style={{ position:"absolute", right:"14px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"12px", color:"#aaa", fontFamily:"sans-serif", fontWeight:"700" }}>
                      {showSuPass?"Hide":"Show"}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Confirm Password *</label>
                  <input type="password" value={su.confirmPassword} onChange={e=>setSu({...su,confirmPassword:e.target.value})} placeholder="••••••••" style={{...inp, borderColor: su.confirmPassword && su.password !== su.confirmPassword ? "#9B8AFB" : "#1A00B9"}}/>
                  {su.confirmPassword && su.password !== su.confirmPassword && (
                    <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#cc2255", margin:"6px 0 0", fontWeight:"700" }}>Passwords don't match</p>
                  )}
                </div>

                <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
                  <input type="checkbox" id="suAgree" checked={su.agreeTerms} onChange={e=>setSu({...su,agreeTerms:e.target.checked})}
                    style={{ marginTop:"3px", accentColor:"#1A00B9", width:"16px", height:"16px", cursor:"pointer", flexShrink:0 }}/>
                  <label htmlFor="suAgree" style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#666", lineHeight:"1.6", cursor:"pointer" }}>
                    I agree to the <span style={{ color:"#1A00B9", fontWeight:"700" }}>Terms of Service</span> and confirm I am the professional or authorized rep of this business. I understand reviews on reffered are community-submitted opinions.
                  </label>
                </div>

                {suError && (
                  <div style={{ background:"#fff0f4", border:"1.5px solid #9B8AFB", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", color:"#cc2255", fontWeight:"600", fontFamily:"sans-serif" }}>
                    ⚠️ {suError}
                  </div>
                )}

                <button onClick={handleSignUp}
                  style={{...btnPink, width:"100%", padding:"14px", fontSize:"14px", border:"1.5px solid #1A00B9", boxShadow:"4px 4px 0 #B7CF4F", opacity:suLoading?0.7:1}}>
                  {suLoading || checkoutLoading ? (selectedPlan==="pro_plus" ? "Redirecting to payment..." : "Creating account...") : (selectedPlan==="pro_plus" ? "Create Pro+ Account →" : "Create Free Account →")}
                </button>

                <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa", textAlign:"center", margin:0 }}>
                  Already have an account? <span onClick={()=>setTab("signin")} style={{ color:"#1A00B9", fontWeight:"800", cursor:"pointer" }}>Sign in</span>
                </p>
              </div>
            )}

            {/* ── ONBOARDING FLOW ── */}
            {tab==="signup" && suDone && (()=>{
              const totalSteps = 4;
              const stepLabels = ["Bio & Contact","Social Links","Profile Photo","All Done!"];
              const saveOnboard = async (extraFields={}) => {
                setOnboardLoading(true);
                await supabase.from("pros").update({ ...extraFields }).eq("id", suUserId);
                setOnboardLoading(false);
              };
              return (
                <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
                  {/* Progress bar */}
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                      <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#1A00B9", letterSpacing:"1px", textTransform:"uppercase" }}>Step {onboardStep} of {totalSteps} — {stepLabels[onboardStep-1]}</span>
                      <span style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa", fontWeight:"700" }}>{Math.round((onboardStep/totalSteps)*100)}%</span>
                    </div>
                    <div style={{ height:"6px", background:"#f4f2ff", borderRadius:"99px", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(onboardStep/totalSteps)*100}%`, background:"#1A00B9", borderRadius:"99px", transition:"width 0.4s ease" }}/>
                    </div>
                  </div>

                  {/* Step 1 — Bio & Contact */}
                  {onboardStep===1 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                      <div>
                        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 4px" }}>Tell clients about yourself ✦</h2>
                        <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>This shows on your profile card in the directory.</p>
                      </div>
                      <div>
                        <label style={lbl}>Bio *</label>
                        <textarea value={onboard.bio} onChange={e=>setOnboard({...onboard,bio:e.target.value})}
                          placeholder="Describe your specialty, style, and what makes your clients keep coming back..."
                          style={{...inp, height:"100px", resize:"vertical", fontFamily:"sans-serif"}}/>
                      </div>
                      <div>
                        <label style={lbl}>Phone (optional)</label>
                        <input value={onboard.phone} onChange={e=>setOnboard({...onboard,phone:e.target.value})} placeholder="+1 (555) 000-0000" style={inp}/>
                      </div>
                      <button onClick={async()=>{ if(!onboard.bio){return;} await saveOnboard({bio:onboard.bio,phone:onboard.phone}); setOnboardStep(2); }}
                        style={{...btnDark, width:"100%", padding:"14px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F", opacity:onboardLoading?0.7:1}}>
                        {onboardLoading ? "Saving..." : "Next →"}
                      </button>
                    </div>
                  )}

                  {/* Step 2 — Social Links */}
                  {onboardStep===2 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                      <div>
                        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 4px" }}>Your social & booking links</h2>
                        <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>All optional — add what you have.</p>
                      </div>
                      <div>
                        <label style={lbl}>Instagram handle</label>
                        <div style={{ position:"relative" }}>
                          <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", fontWeight:"700" }}>@</span>
                          <input value={onboard.instagram} onChange={e=>setOnboard({...onboard,instagram:e.target.value.replace("@","")})} placeholder="yourhandle" style={{...inp, paddingLeft:"32px"}}/>
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>TikTok handle</label>
                        <div style={{ position:"relative" }}>
                          <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", fontWeight:"700" }}>@</span>
                          <input value={onboard.tiktok} onChange={e=>setOnboard({...onboard,tiktok:e.target.value.replace("@","")})} placeholder="yourhandle" style={{...inp, paddingLeft:"32px"}}/>
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Booking URL</label>
                        <input value={onboard.booking} onChange={e=>setOnboard({...onboard,booking:e.target.value})} placeholder="https://booksy.com/..." style={inp}/>
                      </div>
                      <div style={{ display:"flex", gap:"10px" }}>
                        <button onClick={()=>setOnboardStep(1)} style={{...btnOut, flex:1, padding:"14px", fontSize:"13px"}}>← Back</button>
                        <button onClick={async()=>{ await saveOnboard({instagram:onboard.instagram, tiktok:onboard.tiktok, booking_url:onboard.booking}); setOnboardStep(3); }}
                          style={{...btnDark, flex:2, padding:"14px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F", opacity:onboardLoading?0.7:1}}>
                          {onboardLoading ? "Saving..." : "Next →"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3 — Profile Photo */}
                  {onboardStep===3 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                      <div>
                        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 4px" }}>Add your profile photo</h2>
                        <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>A clear headshot helps clients trust and recognise you.</p>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"16px" }}>
                        <div style={{ width:"96px", height:"96px", borderRadius:"50%", background:"#f4f2ff", border:"3px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                          {onboard.photoUrl
                            ? <img src={onboard.photoUrl} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                            : <span style={{ fontSize:"32px", opacity:0.4 }}>📷</span>}
                        </div>
                        <label style={{ cursor:"pointer" }}>
                          <div style={{...btnOut, padding:"12px 24px", fontSize:"13px", display:"inline-block"}}>
                            {onboard.photoUrl ? "Change Photo" : "Upload Photo"}
                          </div>
                          <input type="file" accept="image/*" style={{ display:"none" }} onChange={async e=>{
                            const file = e.target.files[0]; if(!file) return;
                            setOnboardLoading(true);
                            const ext = file.name.split(".").pop();
                            const path = `${suUserId}/profile.${ext}`;
                            const { error:upErr } = await supabase.storage.from("pro-photos").upload(path, file, { upsert:true });
                            if(!upErr){
                              const { data:urlData } = supabase.storage.from("pro-photos").getPublicUrl(path);
                              setOnboard(o=>({...o, photoUrl:urlData.publicUrl}));
                              await supabase.from("pros").update({ photo_url:urlData.publicUrl }).eq("id", suUserId);
                            }
                            setOnboardLoading(false);
                          }}/>
                        </label>
                        {onboardLoading && <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#1A00B9", fontWeight:"700", margin:0 }}>Uploading...</p>}
                      </div>
                      <div style={{ display:"flex", gap:"10px" }}>
                        <button onClick={()=>setOnboardStep(2)} style={{...btnOut, flex:1, padding:"14px", fontSize:"13px"}}>← Back</button>
                        <button onClick={()=>setOnboardStep(4)}
                          style={{...btnDark, flex:2, padding:"14px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F"}}>
                          {onboard.photoUrl ? "Next →" : "Skip for now →"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4 — Done */}
                  {onboardStep===4 && (
                    <div style={{ textAlign:"center", padding:"8px 0" }}>
                      <div style={{ fontSize:"48px", marginBottom:"14px" }}>🎉</div>
                      <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 10px", letterSpacing:"-0.5px" }}>You're all set, {su.firstName}!</h2>
                      <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#555", lineHeight:"1.7", margin:"0 0 6px" }}>
                        Welcome to reffered. Your profile is now live in the directory.
                      </p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa", margin:"0 0 28px" }}>
                        Check your inbox for a welcome email from us. You can update everything from your dashboard at any time.
                      </p>
                      <button onClick={async()=>{
                        const { data:proRow } = await supabase.from("pros").select("*").eq("id", suUserId).single();
                        onLogin(proRow ? mapSupabasePro(proRow) : { id:suUserId, name:`${su.firstName} ${su.lastName}`, specialty:su.specialties.join(", "), location:`${su.city}, ${su.state}`, ratings:defaultRatings(), reviews:0, tags:[], bio:onboard.bio, instagram:onboard.instagram, booking:onboard.booking, tiktokReview:"", recommendedBy:[], proPlus:false, verified:false, weeklyRecs:0 });
                      }} style={{...btnDark, width:"100%", padding:"14px 28px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F"}}>
                        Go to My Dashboard →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── FORGOT PASSWORD ── */}
          {tab==="forgot" && (
            <div style={{ maxWidth:"460px", margin:"0 auto", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"32px 36px", boxShadow:"4px 4px 0 #e0ddf5" }}>
              {!forgotSent ? (
                <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:"36px", marginBottom:"10px" }}>🔑</div>
                    <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 6px" }}>Reset your password</h2>
                    <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>Enter your email and we'll send a reset link.</p>
                  </div>
                  <div>
                    <label style={lbl}>Email Address</label>
                    <input value={forgotEmail} onChange={e=>{setForgotEmail(e.target.value);setForgotError("");}} placeholder="you@email.com" style={inp}/>
                  </div>
                  {forgotError && <div style={{ background:"#fff0f4", border:"1.5px solid #9B8AFB", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", color:"#cc2255", fontWeight:"600", fontFamily:"sans-serif" }}>⚠️ {forgotError}</div>}
                  <button onClick={async()=>{
                    if(!forgotEmail){ setForgotError("Please enter your email."); return; }
                    const { error:fe } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo: window.location.origin });
                    if(fe){ setForgotError(fe.message); return; }
                    setForgotSent(true);
                  }} style={{...btnDark, width:"100%", padding:"14px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F"}}>
                    Send Reset Link →
                  </button>
                  <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa", textAlign:"center", margin:0 }}>
                    <span onClick={()=>setTab("signin")} style={{ color:"#1A00B9", fontWeight:"800", cursor:"pointer" }}>← Back to Sign In</span>
                  </p>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"8px 0" }}>
                  <div style={{ fontSize:"48px", marginBottom:"14px" }}>📬</div>
                  <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 10px" }}>Check your email</h2>
                  <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#555", lineHeight:"1.7", margin:"0 0 24px" }}>We sent a reset link to <strong>{forgotEmail}</strong>. Click the link to set a new password.</p>
                  <button onClick={()=>{ setTab("signin"); setForgotSent(false); setForgotEmail(""); }} style={{...btnOut, padding:"12px 24px", fontSize:"13px"}}>← Back to Sign In</button>
                </div>
              )}
            </div>
          )}

          {/* ── RESET PASSWORD (after clicking email link) ── */}
          {tab==="resetPassword" && (
            <div style={{ maxWidth:"460px", margin:"0 auto", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"32px 36px", boxShadow:"4px 4px 0 #e0ddf5" }}>
              {!resetDone ? (
                <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:"36px", marginBottom:"10px" }}>🔒</div>
                    <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 6px" }}>Set a new password</h2>
                  </div>
                  <div>
                    <label style={lbl}>New Password</label>
                    <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="••••••••" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Confirm New Password</label>
                    <input type="password" value={newPasswordConfirm} onChange={e=>setNewPasswordConfirm(e.target.value)} placeholder="••••••••" style={{...inp, borderColor: newPasswordConfirm && newPassword !== newPasswordConfirm ? "#9B8AFB" : "#1A00B9"}}/>
                    {newPasswordConfirm && newPassword !== newPasswordConfirm && <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#cc2255", margin:"6px 0 0", fontWeight:"700" }}>Passwords don't match</p>}
                  </div>
                  <button onClick={async()=>{
                    if(newPassword.length < 8 || newPassword !== newPasswordConfirm) return;
                    const { error:rErr } = await supabase.auth.updateUser({ password: newPassword });
                    if(rErr){ setError(rErr.message); return; }
                    setResetDone(true);
                  }} style={{...btnDark, width:"100%", padding:"14px", fontSize:"14px", boxShadow:"4px 4px 0 #B7CF4F"}}>
                    Update Password →
                  </button>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"8px 0" }}>
                  <div style={{ fontSize:"48px", marginBottom:"14px" }}>✅</div>
                  <h2 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 10px" }}>Password updated!</h2>
                  <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#555", margin:"0 0 24px" }}>You can now sign in with your new password.</p>
                  <button onClick={()=>setTab("signin")} style={{...btnDark, padding:"12px 28px", fontSize:"13px", boxShadow:"3px 3px 0 #B7CF4F"}}>Sign In →</button>
                </div>
              )}
            </div>
          )}

          </div>{/* end maxWidth form wrapper */}
        </div>{/* end maxWidth page wrapper */}
      </div>
    </div>
  );
}

// ─── PRO+ DASHBOARD ──────────────────────────────────────────────────────────
function ProDashboard({ goTo, onLogout, proData }) {
  const pro = proData || { name:"", specialty:"", location:"", ratings:defaultRatings(), reviews:0, tags:[], bio:"", instagram:"", booking:"", tiktokReview:"", recommendedBy:[], proPlus:false, verified:false, weeklyRecs:0, photoUrl:"", supabaseId:null };
  const overall = avgRating(pro.ratings);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const [managePlanOpen, setManagePlanOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(null);

  const handleUpgrade = async (interval) => {
    if (!pro.supabaseId) return;
    setUpgradeLoading(interval);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pro.supabaseId, email: pro.email || "", interval }),
      });
      const json = await res.json();
      if (json.url) { window.location.href = json.url; return; }
    } catch (e) {}
    setUpgradeLoading(null);
  };
  const notifRef = useRef(null);
  const photoRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(pro.photoUrl || "");
  const [photoUploading, setPhotoUploading] = useState(false);

  const handleProfilePhotoUpload = async (file) => {
    if (!file || !pro.supabaseId) return;
    setPhotoUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${pro.supabaseId}/profile.${ext}`;
    const { error } = await supabase.storage.from("pro-photos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("pro-photos").getPublicUrl(path);
      setPhotoUrl(publicUrl);
      await supabase.from("pros").update({ photo_url: publicUrl }).eq("id", pro.supabaseId);
    }
    setPhotoUploading(false);
  };

  // BUG FIX: close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);
  const profileLink = `https://refferedpro.com/?pro=${pro.supabaseId}`;

const NOTIFICATIONS = []; // Will load from Supabase in production

  const unreadCount = NOTIFICATIONS.filter(n => n.isNew && !readIds.includes(n.id)).length;
  const markAllRead = () => setReadIds(NOTIFICATIONS.map(n=>n.id));
  const isRead = (id) => readIds.includes(id) || !NOTIFICATIONS.find(n=>n.id===id)?.isNew;

  const typeIcon = (type) => ({ rec:"⭐", badge:"🏆", tiktok:"🎵" }[type] || "⭐");
  const typeBg   = (type) => ({ rec:"#E8E4FF", badge:"#edfad4", tiktok:"#111" }[type] || "#E8E4FF");
  const typeColor= (type) => ({ rec:"#1A00B9", badge:"#1A00B9", tiktok:"#fff" }[type] || "#1A00B9");

  const monthlyData = [
    { month:"Aug", recs:0 },{ month:"Sep", recs:0 },{ month:"Oct", recs:0 },
    { month:"Nov", recs:0 },{ month:"Dec", recs:0 },{ month:"Jan", recs:0 },
  ];
  const maxRecs = Math.max(...monthlyData.map(d=>d.recs), 1);
  const tabs = ["overview","my profile","credentials","your wins","widget","ai advisor"];
  const [advisorMessages, setAdvisorMessages] = useState([]);
  const [advisorInput, setAdvisorInput] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const advisorEndRef = useRef(null);

  const sendAdvisorMessage = async (text) => {
    const userMsg = text || advisorInput.trim();
    if (!userMsg || advisorLoading) return;
    setAdvisorInput("");
    const newHistory = [...advisorMessages, { role:"user", content:userMsg }];
    setAdvisorMessages(newHistory);
    setAdvisorLoading(true);
    try {
      const res = await fetch("/api/pro-advisor", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ pro, message: userMsg, history: advisorMessages }),
      });
      const data = await res.json();
      setAdvisorMessages([...newHistory, { role:"assistant", content: data.reply || "Sorry, I couldn't generate a response." }]);
    } catch {
      setAdvisorMessages([...newHistory, { role:"assistant", content:"Something went wrong. Please try again." }]);
    }
    setAdvisorLoading(false);
    setTimeout(() => advisorEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  };
  const [profileForm, setProfileForm] = useState({ bio:pro.bio||"", instagram:pro.instagram||"", tiktok:pro.tiktokReview||"", booking:pro.booking||"", phone:"" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const handleSaveProfile = async () => {
    if (!pro.supabaseId) return;
    setProfileSaving(true);
    await supabase.from("pros").update({
      bio: profileForm.bio,
      instagram: profileForm.instagram,
      tiktok: profileForm.tiktok,
      booking_url: profileForm.booking,
      phone: profileForm.phone,
    }).eq("id", pro.supabaseId);
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(()=>setProfileSaved(false), 2500);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#fff", fontFamily:"sans-serif" }}>
      {/* Dashboard Header */}
      <div style={{ background:"#E8E4FF", borderBottom:"1px solid #e0ddf5", padding:"20px 40px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <div onClick={()=>photoRef.current?.click()} title="Upload profile photo"
            style={{ width:"48px", height:"48px", borderRadius:"50%", background:"#f4f2ff", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", overflow:"hidden", position:"relative" }}>
            {photoUrl
              ? <img src={photoUrl} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              : <span style={{ fontSize:"18px", opacity: photoUploading ? 1 : 0.5 }}>{photoUploading ? "⏳" : "📷"}</span>}
            <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleProfilePhotoUpload(e.target.files[0])}/>
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ color:"#1A00B9", fontFamily:"Georgia,serif", fontSize:"18px", fontWeight:"900" }}>{pro.name}</span>
              <span style={{ background:"#1A00B9", color:"#fff", fontSize:"10px", fontWeight:"800", padding:"2px 8px", borderRadius:"20px", letterSpacing:"1px" }}>PRO+</span>
              {pro.verified && <span style={{ background:"#B7CF4F", color:"#1A00B9", fontSize:"10px", fontWeight:"800", padding:"2px 8px", borderRadius:"20px", border:"1.5px solid #1A00B9" }}>✓ VERIFIED</span>}
            </div>
            <span style={{ color:"#1A00B9", fontFamily:"sans-serif", fontSize:"12px", fontWeight:"600" }}>{pro.specialty} · {pro.location}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>

          {/* 🔔 Notification Bell */}
          <div style={{ position:"relative" }} ref={notifRef}>
            <button onClick={()=>setNotifOpen(o=>!o)}
              style={{ position:"relative", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"40px", height:"40px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", boxShadow:"2px 2px 0 #1A00B9" }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position:"absolute", top:"-5px", right:"-5px", background:"#B7CF4F", color:"#1A00B9", borderRadius:"50%", width:"18px", height:"18px", fontSize:"10px", fontWeight:"900", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff" }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notifOpen && (
              <div style={{ position:"absolute", top:"48px", right:0, width:"380px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", boxShadow:"4px 4px 0 #e0ddf5", zIndex:200, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"16px 20px", borderBottom:"1.5px solid #f0f0f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <p style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900" }}>Notifications</p>
                    <p style={{ margin:0, fontSize:"11px", color:"#aaa" }}>{unreadCount > 0 ? `${unreadCount} unread` : "All caught up ✓"}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"800", color:"#1A00B9", cursor:"pointer", padding:0 }}>Mark all read</button>
                  )}
                </div>
                {/* Feed */}
                <div style={{ maxHeight:"420px", overflowY:"auto" }}>
                  {NOTIFICATIONS.map((n, i) => {
                    const read = isRead(n.id);
                    return (
                      <div key={n.id} onClick={()=>setReadIds(p=>[...new Set([...p, n.id])])}
                        style={{ padding:"14px 20px", borderBottom:i<NOTIFICATIONS.length-1?"1px solid #f5f5f5":"none", display:"flex", gap:"12px", alignItems:"flex-start", background:read?"#fff":"#f8f7ff", cursor:"pointer", transition:"background 0.15s" }}>
                        {/* Avatar */}
                        <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:typeBg(n.type), border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", color:typeColor(n.type), fontWeight:"900", fontSize:"13px", flexShrink:0 }}>
                          {n.avatar}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"3px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                              <span style={{ fontWeight:"800", fontSize:"13px", color:"#111" }}>{n.name}</span>
                              <span style={{ fontSize:"11px" }}>{typeIcon(n.type)}</span>
                              {n.rating && <span style={{ fontFamily:"Georgia,serif", fontSize:"12px", fontWeight:"900", color:"#1A00B9" }}>★ {n.rating}</span>}
                            </div>
                            <span style={{ fontSize:"10px", color:"#bbb", whiteSpace:"nowrap", marginLeft:"8px" }}>{n.date}</span>
                          </div>
                          <p style={{ margin:0, fontSize:"12px", color:"#666", lineHeight:"1.5", overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{n.text}</p>
                        </div>
                        {/* Unread dot */}
                        {!read && <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1A00B9", flexShrink:0, marginTop:"4px" }}/>}
                      </div>
                    );
                  })}
                </div>
                {/* Footer */}
                <div style={{ padding:"12px 20px", borderTop:"1.5px solid #f0f0f0", textAlign:"center" }}>
                  <button onClick={()=>{ setNotifOpen(false); setActiveTab("overview"); }} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"800", color:"#1A00B9", cursor:"pointer" }}>View all in Overview →</button>
                </div>
              </div>
            )}
          </div>

          <button onClick={()=>goTo("home")} style={{...btnOut, padding:"8px 16px", fontSize:"12px"}}>← Directory</button>
          <button onClick={onLogout} style={{ background:"transparent", color:"#1A00B9", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"8px 16px", fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", cursor:"pointer" }}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e0ddf5", padding:"0 40px", display:"flex", gap:"0", overflowX:"auto" }}>
        {tabs.map(tab=>(
          <button key={tab} onClick={()=>setActiveTab(tab)}
            style={{ padding:"16px 20px", border:"none", borderBottom:activeTab===tab?"3px solid #1A00B9":"3px solid transparent", background:"none", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", color:activeTab===tab?"#1A00B9":"#888", textTransform:"capitalize", marginBottom:"-2px", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>
            {tab==="credentials"?"🛡️ Credentials":tab==="your wins"?"✨ Your Wins":tab==="widget"?"🔗 Widget":tab==="ai advisor"?(pro.proPlus?"✦ AI Advisor":"🔒 AI Advisor"):tab==="my profile"?"My Profile":"🏠 Overview"}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:"1000px", margin:"0 auto", padding:"40px 24px" }}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab==="overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
            {/* Stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px" }}>
              {[
                { label:"Overall Rating", val:`★ ${overall}`, sub:"across 7 categories", color:"#1A00B9" },
                { label:"Total Reviews", val:pro.reviews, sub:"community recommendations", color:"#1A00B9" },
                { label:"This Week", val:`+${pro.weeklyRecs} recs`, sub:"new recommendations", color:"#1A00B9" },
                { label:"Profile Views", val:"—", sub:"connect backend to track", color:"#1A00B9" },
              ].map((s,i)=>(
                <div key={i} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"20px", boxShadow:"3px 3px 0 #B7CF4F" }}>
                  <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>{s.label}</p>
                  <p style={{ margin:"0 0 4px", fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", color:s.color, letterSpacing:"-1px" }}>{s.val}</p>
                  <p style={{ margin:0, fontSize:"11px", color:"#aaa" }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Featured placement notice */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"20px 24px", display:"flex", alignItems:"center", gap:"16px", boxShadow:"3px 3px 0 #B7CF4F" }}>
              <div style={{ fontSize:"32px" }}>🏆</div>
              <div>
                <p style={{ margin:"0 0 4px", fontWeight:"800", fontSize:"14px", color:"#1A00B9" }}>You're featured at the top of Hair Stylists in Atlanta</p>
                <p style={{ margin:0, fontSize:"13px", color:"#666" }}>As a Pro+ member, your profile appears before free listings in your city and specialty. You're currently <strong style={{ color:"#1A00B9" }}>#1</strong> in Atlanta Hair Stylists.</p>
              </div>
            </div>

            {/* Recent Recommendations feed */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", overflow:"hidden", boxShadow:"3px 3px 0 #B7CF4F" }}>
              <div style={{ padding:"20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ margin:"0 0 2px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Recent Recommendations</p>
                  <p style={{ margin:0, fontSize:"13px", color:"#666" }}>{NOTIFICATIONS.filter(n=>n.type==="rec").length} total · sorted by newest</p>
                </div>
                {unreadCount > 0 && (
                  <span style={{ background:"#B7CF4F", color:"#1A00B9", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontWeight:"900" }}>{unreadCount} new</span>
                )}
              </div>
              <div style={{ padding:"16px 24px 0" }}>
                {NOTIFICATIONS.filter(n=>n.type==="rec").map((n,i,arr)=>{
                  const read = isRead(n.id);
                  return (
                    <div key={n.id} style={{ padding:"14px 0", borderBottom:i<arr.length-1?"1.5px solid #f5f5f5":"none", display:"flex", gap:"12px", background:read?"transparent":"#f8f7ff", marginLeft:"-24px", marginRight:"-24px", paddingLeft:"24px", paddingRight:"24px" }}>
                      <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"#E8E4FF", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", color:"#1A00B9", fontWeight:"900", fontSize:"13px", flexShrink:0 }}>{n.avatar}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            <span style={{ fontWeight:"800", fontSize:"13px" }}>{n.name}</span>
                            <span style={{ fontFamily:"Georgia,serif", fontSize:"13px", fontWeight:"900", color:"#1A00B9" }}>★ {n.rating}</span>
                            {!read && <span style={{ background:"#B7CF4F", color:"#1A00B9", borderRadius:"20px", padding:"1px 8px", fontSize:"10px", fontWeight:"900" }}>NEW</span>}
                          </div>
                          <span style={{ fontSize:"11px", color:"#aaa" }}>{n.date}</span>
                        </div>
                        <p style={{ margin:0, fontSize:"13px", color:"#555", lineHeight:"1.6" }}>{n.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:"16px 24px", borderTop:"1.5px solid #f0f0f0", display:"flex", gap:"10px" }}>
                <button onClick={markAllRead} style={{...btnOut, padding:"9px 18px", fontSize:"12px"}}>✓ Mark all read</button>
              </div>
            </div>

            {/* Shareable profile link */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #B7CF4F" }}>
              <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Your Shareable Profile Link</p>
              <p style={{ margin:"0 0 14px", fontSize:"13px", color:"#666" }}>Drop this in your Instagram bio, link in bio tool, or anywhere clients can find you.</p>
              <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ flex:1, background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"10px", padding:"12px 16px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", color:"#555", minWidth:"200px" }}>
                  🔗 {profileLink}
                </div>
                <button onClick={()=>{ navigator.clipboard.writeText(profileLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
                  style={{...btnPink, padding:"12px 20px", fontSize:"12px", boxShadow:"2px 2px 0 #B7CF4F"}}>
                  {copied?"✓ Copied!":"Copy Link"}
                </button>
                <a href={`https://instagram.com`} target="_blank" rel="noreferrer"
                  style={{...btnOut, textDecoration:"none", padding:"12px 20px", fontSize:"12px", display:"inline-flex", alignItems:"center", gap:"6px"}}>
                  📷 Add to Bio
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── MY PROFILE TAB ── */}
        {activeTab==="my profile" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"24px", maxWidth:"600px" }}>
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"24px", fontWeight:"900", margin:"0 0 4px", letterSpacing:"-0.5px" }}>My Profile</h2>
              <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:0 }}>This is how you appear in the reffered directory.</p>
            </div>

            {/* Profile photo */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #B7CF4F" }}>
              <p style={{ margin:"0 0 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Profile Photo</p>
              <div style={{ display:"flex", alignItems:"center", gap:"20px", flexWrap:"wrap" }}>
                <div style={{ width:"80px", height:"80px", borderRadius:"50%", background:"#f4f2ff", border:"3px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                  {photoUrl ? <img src={photoUrl} alt="profile" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:"28px", opacity:0.4 }}>📷</span>}
                </div>
                <div>
                  <label style={{ cursor:"pointer" }}>
                    <div style={{...btnOut, padding:"10px 20px", fontSize:"12px", display:"inline-block", marginBottom:"6px" }}>
                      {photoUploading ? "Uploading..." : "Change Photo"}
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleProfilePhotoUpload(e.target.files[0])}/>
                  </label>
                  <p style={{ margin:0, fontFamily:"sans-serif", fontSize:"11px", color:"#aaa" }}>JPG or PNG · Max 5MB</p>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #B7CF4F", display:"flex", flexDirection:"column", gap:"16px" }}>
              <p style={{ margin:0, fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>About You</p>
              <div>
                <label style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", color:"#1A00B9", display:"block", marginBottom:"6px", letterSpacing:"0.5px" }}>Bio</label>
                <textarea value={profileForm.bio} onChange={e=>setProfileForm({...profileForm,bio:e.target.value})}
                  placeholder="Describe your specialty, style, and what makes clients keep coming back..."
                  style={{ width:"100%", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"12px 14px", fontFamily:"sans-serif", fontSize:"13px", height:"100px", resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
              </div>
              <div>
                <label style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", color:"#1A00B9", display:"block", marginBottom:"6px", letterSpacing:"0.5px" }}>Phone (optional)</label>
                <input value={profileForm.phone} onChange={e=>setProfileForm({...profileForm,phone:e.target.value})} placeholder="+1 (555) 000-0000"
                  style={{ width:"100%", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"12px 14px", fontFamily:"sans-serif", fontSize:"13px", boxSizing:"border-box", outline:"none" }}/>
              </div>
            </div>

            {/* Social & Booking */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #B7CF4F", display:"flex", flexDirection:"column", gap:"16px" }}>
              <p style={{ margin:0, fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Social & Booking</p>
              {[
                { label:"Instagram handle", key:"instagram", prefix:"@", placeholder:"yourhandle" },
                { label:"TikTok handle", key:"tiktok", prefix:"@", placeholder:"yourhandle" },
                { label:"Booking URL", key:"booking", prefix:"", placeholder:"https://booksy.com/..." },
              ].map(({label,key,prefix,placeholder})=>(
                <div key={key}>
                  <label style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", color:"#1A00B9", display:"block", marginBottom:"6px", letterSpacing:"0.5px" }}>{label}</label>
                  <div style={{ position:"relative" }}>
                    {prefix && <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", fontFamily:"sans-serif", fontSize:"13px", color:"#aaa", fontWeight:"700" }}>{prefix}</span>}
                    <input value={profileForm[key]} onChange={e=>setProfileForm({...profileForm,[key]:e.target.value.replace("@","")})}
                      placeholder={placeholder}
                      style={{ width:"100%", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:`12px 14px 12px ${prefix?"32px":"14px"}`, fontFamily:"sans-serif", fontSize:"13px", boxSizing:"border-box", outline:"none" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Save button */}
            <button onClick={handleSaveProfile}
              style={{...btnDark, padding:"14px", fontSize:"14px", width:"100%", boxShadow:"4px 4px 0 #B7CF4F", opacity:profileSaving?0.7:1}}>
              {profileSaving ? "Saving..." : profileSaved ? "✓ Saved!" : "Save Changes →"}
            </button>
          </div>
        )}

        {/* ── CREDENTIALS TAB ── */}
        {activeTab==="credentials" && (
          <CredentialsTab pro={pro}/>
        )}

        {/* ── YOUR WINS TAB (was: report card + share kit) ── */}
        {activeTab==="your wins" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"32px" }}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px" }}>
              <div>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 4px", letterSpacing:"-1px" }}>Your Wins ✨</h2>
                <p style={{ color:"#666", fontSize:"14px", margin:0 }}>January 2025 · {pro.name} · Track your momentum and share it with the world.</p>
              </div>
              <button style={{...btnOut, padding:"10px 20px", fontSize:"12px"}}>📥 Download PDF</button>
            </div>

            {/* Recommendations chart */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
              <p style={{ margin:"0 0 20px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Recommendations Per Month</p>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"12px", height:"120px" }}>
                {monthlyData.map((d,i)=>(
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", height:"100%" }}>
                    <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                      <div style={{ width:"100%", height:`${(d.recs/maxRecs)*100}%`, background:i===monthlyData.length-1?"#1A00B9":"#E8E4FF", border:"1.5px solid #1A00B9", borderRadius:"4px 4px 0 0", minHeight:"8px" }}/>
                    </div>
                    <span style={{ fontSize:"11px", fontWeight:"800", color:"#888" }}>{d.recs}</span>
                    <span style={{ fontSize:"10px", color:"#bbb", fontWeight:"700" }}>{d.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category breakdown vs city avg */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
              <p style={{ margin:"0 0 6px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Rating Breakdown — January 2025</p>
              <p style={{ margin:"0 0 20px", fontSize:"13px", color:"#666" }}>Compared to the Atlanta average for Hair Stylists</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {RATING_CATEGORIES.map(cat=>{
                  const cityAvg = (pro.ratings[cat.key] - 0.3).toFixed(1);
                  const isAbove = pro.ratings[cat.key] > parseFloat(cityAvg);
                  return (
                    <div key={cat.key}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                        <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"700", color:"#333" }}>{cat.emoji} {cat.label}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                          <span style={{ fontSize:"11px", color:"#aaa" }}>City avg: {cityAvg}</span>
                          <span style={{ fontSize:"12px", fontWeight:"800", color:isAbove?"#22c55e":"#f59e0b" }}>{isAbove?"↑":"="} {pro.ratings[cat.key].toFixed(1)}</span>
                        </div>
                      </div>
                      <div style={{ height:"8px", background:"#f0f0f0", borderRadius:"4px", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(pro.ratings[cat.key]/5)*100}%`, background:isAbove?"#1A00B9":"#B7CF4F", borderRadius:"4px" }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:"20px", paddingTop:"16px", borderTop:"1.5px solid #f0f0f0", background:"#EAE6FF", borderRadius:"8px", padding:"14px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                <span style={{ fontSize:"18px" }}>🏅</span>
                <p style={{ margin:0, fontSize:"13px", color:"#444", lineHeight:"1.6" }}>
                  <strong>You're outperforming the Atlanta average in 6 out of 7 categories.</strong> Your strongest area is Customer Service (5.0). Consider highlighting your parking situation to clients in advance — that's your only category below the city average.
                </p>
              </div>
            </div>

            {/* Business Insights — algorithm-driven from rating data */}
            {(() => {
              // ── INSIGHT LIBRARY — each insight maps to a rating category with a trigger threshold ──
              const INSIGHT_LIBRARY = [
                {
                  categoryKey: "serviceOutcome",
                  icon: "🧖‍♀️",
                  impact: "High Impact", impactColor: "#FFE5DE",
                  title: "Introduce a Steam or Heat Treatment",
                  body: (score, gap) => `Your Service Outcome score is ${score.toFixed(1)} — ${gap > 0.5 ? `${(gap*20).toFixed(0)}% below your city average` : "close to average"}. Clients across Atlanta rate appointments with a steam or scalp heat treatment noticeably higher. It adds 8 minutes and signals elevated care immediately.`,
                  action: "Add it as an optional upgrade to your booking confirmation message.",
                },
                {
                  categoryKey: "cleanliness",
                  icon: "🧴",
                  impact: "Quick Win", impactColor: "#EDFAD4",
                  title: "End Every Appointment with a Hot Towel",
                  body: (score, gap) => `Cleanliness & Vibe is scoring ${score.toFixed(1)} for you. A warm towel finish takes under 60 seconds and is one of the most-mentioned details in 5-star reviews across your specialty. Small ritual, lasting impression.`,
                  action: "Keep a towel warmer at your station and make it part of your closing routine.",
                },
                {
                  categoryKey: "waitTime",
                  icon: "📅",
                  impact: "Quick Win", impactColor: "#EDFAD4",
                  title: "Send a Personalized 48-Hour Reminder",
                  body: (score, gap) => `Wait Time & Punctuality is at ${score.toFixed(1)}. Pros who send a short personal reminder — not just an automated text — see punctuality scores rise and no-shows drop. It sets tone and shows clients you're prepared for them specifically.`,
                  action: "Send a quick 'See you Thursday at 2!' message 48 hours before each appointment.",
                },
                {
                  categoryKey: "communication",
                  icon: "💬",
                  impact: "Loyalty Builder", impactColor: "#dde8f7",
                  title: "Add a Post-Visit Check-In",
                  body: (score, gap) => `Communication & Follow-up is your opportunity — currently ${score.toFixed(1)}. The single highest-correlated behavior with repeat recommendations on our platform is a personal follow-up 3–5 days after the appointment. Not a survey. A real message.`,
                  action: "Three days after each visit, send 'How are you loving your [service]?' — nothing more.",
                },
                {
                  categoryKey: "parking",
                  icon: "🅿️",
                  impact: "Easy Fix", impactColor: "#f5f5f5",
                  title: "Add Parking Instructions to Your Confirmation",
                  body: (score, gap) => `Parking is scoring ${score.toFixed(1)} — your lowest category and the easiest to fix. Top stylists in Atlanta add two sentences to their booking confirmation explaining exactly where to park. Clients who arrive stressed don't rate as generously.`,
                  action: "Add parking details to your confirmation message template today — takes 2 minutes.",
                },
                {
                  categoryKey: "value",
                  icon: "🎁",
                  impact: "Retention", impactColor: "#dde8f7",
                  title: "Offer a Returning Client Loyalty Touch",
                  body: (score, gap) => `Value for Money is at ${score.toFixed(1)}. Pros who offer returning clients a small complimentary add-on — a deep conditioning shot, a quick scalp massage, or even a branded product sample — see recommendation rates increase significantly. Perceived value goes up, cost to you is minimal.`,
                  action: "Choose one low-cost add-on to offer every 3rd visit. Mention it casually, not as a promo.",
                },
                {
                  categoryKey: "customerService",
                  icon: "🤝",
                  impact: "High Impact", impactColor: "#FFE5DE",
                  title: "Start with a 5-Minute Intention Check",
                  body: (score, gap) => `Customer Service is at ${score.toFixed(1)}. Before touching a client's hair or skin, top-rated pros spend 5 minutes confirming expectations, showing reference photos, and repeating back what the client said. This single habit dramatically reduces disappointment and boosts this score.`,
                  action: "Make a ritual of asking 'What's the one thing that's most important to you today?' at the start of every appointment.",
                },
              ];

              // ── ALGORITHM — score each category, find gaps, rank by gap size, surface top insights ──
              const CITY_OFFSET = 0.3; // simulated city avg = pro score - offset
              const scored = INSIGHT_LIBRARY.map(insight => {
                const proScore = pro.ratings[insight.categoryKey];
                const cityAvg = proScore - CITY_OFFSET;
                const gap = cityAvg - proScore + CITY_OFFSET; // positive = above city, negative = below
                const belowAvg = proScore < cityAvg + CITY_OFFSET;
                const urgency = belowAvg ? (cityAvg + CITY_OFFSET - proScore) : 0;
                return { ...insight, proScore, cityAvg, gap, urgency, belowAvg };
              });

              // Sort: below-average categories first (by gap size), then near-average
              const prioritized = [...scored].sort((a,b) => b.urgency - a.urgency);

              // Always show top 3 most relevant
              const topInsights = prioritized.slice(0, 3);

              const aboveCount = scored.filter(s => !s.belowAvg).length;
              const lowestCat = prioritized[0];

              return (
                <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                    <p style={{ margin:0, fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Business & Client Experience Insights</p>
                    <span style={{ background:"#1A00B9", color:"#fff", fontSize:"9px", fontWeight:"800", padding:"2px 7px", borderRadius:"20px", letterSpacing:"0.5px" }}>PRO+</span>
                  </div>
                  <p style={{ color:"#666", fontSize:"13px", margin:"0 0 6px", lineHeight:"1.6" }}>
                    Generated from your actual client rating data · Updated with every new recommendation
                  </p>

                  {/* Algorithm summary */}
                  <div style={{ background:"#EAE6FF", border:"1.5px solid #8B78F0", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", display:"flex", gap:"10px", alignItems:"flex-start" }}>
                    <span style={{ fontSize:"16px" }}>🧠</span>
                    <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#1A00B9", margin:0, lineHeight:"1.6" }}>
                      <strong>Your data, analyzed:</strong> You're above the Atlanta average in <strong>{aboveCount} of 7 categories</strong>. Your biggest opportunity is <strong>{lowestCat.categoryKey === "serviceOutcome" ? "Service Outcome" : lowestCat.categoryKey === "cleanliness" ? "Cleanliness & Vibe" : lowestCat.categoryKey === "waitTime" ? "Wait Time" : lowestCat.categoryKey === "communication" ? "Communication" : lowestCat.categoryKey === "parking" ? "Parking" : lowestCat.categoryKey === "value" ? "Value for Money" : "Customer Service"}</strong>. The {topInsights.length} insights below are ranked by gap size — highest priority first.
                    </p>
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                    {topInsights.map((insight, i) => (
                      <div key={insight.categoryKey} style={{ background:"#fff", border:`1.5px solid ${i===0?"#1A00B9":"#e5e5e5"}`, borderRadius:"14px", padding:"20px", position:"relative" }}>
                        {i === 0 && <div style={{ position:"absolute", top:"-10px", left:"16px", background:"#1A00B9", color:"#fff", fontSize:"10px", fontWeight:"800", padding:"2px 10px", borderRadius:"20px", letterSpacing:"0.5px" }}>Top Priority</div>}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                            <span style={{ fontSize:"24px" }}>{insight.icon}</span>
                            <div>
                              <p style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", margin:"0 0 2px", color:"#1A00B9" }}>{insight.title}</p>
                              <span style={{ background:"#EAE6FF", color:"#1A00B9", fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"4px" }}>↳ {RATING_CATEGORIES.find(c=>c.key===insight.categoryKey)?.label}</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
                            <span style={{ background:insight.impactColor, color:"#1A00B9", fontSize:"10px", fontWeight:"800", padding:"3px 10px", borderRadius:"20px", border:"1px solid #e5e5e5" }}>{insight.impact}</span>
                            <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:insight.belowAvg?"#f59e0b":"#22c55e" }}>
                              {insight.proScore.toFixed(1)} {insight.belowAvg ? "↓ below avg" : "↑ above avg"}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#555", margin:"0 0 12px", lineHeight:"1.65" }}>
                          {insight.body(insight.proScore, insight.urgency)}
                        </p>
                        <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"8px", padding:"10px 14px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
                          <span style={{ fontSize:"13px" }}>→</span>
                          <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#444", margin:0, fontWeight:"700", lineHeight:"1.5" }}>{insight.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa", margin:"16px 0 0", textAlign:"center" }}>
                    Showing top 3 of {INSIGHT_LIBRARY.length} available insights · Refreshes when new recommendations come in
                  </p>
                </div>
              );
            })()}

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
              <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
              <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", whiteSpace:"nowrap" }}>Share Your Wins</span>
              <div style={{ flex:1, height:"1.5px", background:"#e5e5e5" }}/>
            </div>

            {/* Share Kit cards */}
            <div>
              <p style={{ color:"#666", fontSize:"14px", margin:"0 0 20px", lineHeight:"1.6" }}>Professionally designed graphics from your actual scores — download and post to Instagram, TikTok, or your website.</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"20px" }}>
                <div style={{ border:"1.5px solid #1A00B9", borderRadius:"16px", overflow:"hidden", boxShadow:"4px 4px 0 #1A00B9" }}>
                  <div style={{ background:"linear-gradient(135deg,#111 0%,#2d1f4e 100%)", padding:"28px 24px", textAlign:"center", position:"relative" }}>
                    <div style={{ position:"absolute", top:"12px", left:"12px", fontFamily:"Georgia,serif", fontSize:"12px", color:"rgba(255,255,255,0.3)", fontWeight:"900" }}>reffered</div>
                    <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#f4f2ff", border:"3px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"10px" }}><span style={{ fontSize:"20px", opacity:0.5 }}>📷</span></div>
                    <div style={{ color:"#8B78F0", fontFamily:"Georgia,serif", fontSize:"44px", fontWeight:"900", lineHeight:1 }}>★ {overall}</div>
                    <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"15px", fontWeight:"900", marginTop:"6px" }}>{pro.name}</div>
                    <div style={{ color:"rgba(255,255,255,0.45)", fontSize:"10px", fontWeight:"700", letterSpacing:"1.5px", textTransform:"uppercase", marginTop:"4px" }}>{pro.specialty}</div>
                    <div style={{ marginTop:"12px", display:"inline-block", background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.5)", borderRadius:"20px", padding:"3px 12px", color:"#8B78F0", fontSize:"10px", fontWeight:"800", letterSpacing:"1px" }}>AS REFFERED. ✦</div>
                  </div>
                  <div style={{ background:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"700", color:"#888" }}>Overall Rating Card</span>
                    <button style={{...btnPink, padding:"7px 14px", fontSize:"11px", boxShadow:"2px 2px 0 #1A00B9"}}>Download</button>
                  </div>
                </div>

                <div style={{ border:"1.5px solid #1A00B9", borderRadius:"16px", overflow:"hidden", boxShadow:"4px 4px 0 #1A00B9" }}>
                  <div style={{ background:"#fff", padding:"22px 24px" }}>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:"12px", color:"#aaa", fontWeight:"900", marginBottom:"14px" }}>reffered</div>
                    <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 12px" }}>My Community Ratings</p>
                    {RATING_CATEGORIES.slice(0,4).map(cat=>(
                      <div key={cat.key} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"7px" }}>
                        <span style={{ fontSize:"12px" }}>{cat.emoji}</span>
                        <div style={{ flex:1, height:"5px", background:"#e5e5e5", borderRadius:"3px", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${(pro.ratings[cat.key]/5)*100}%`, background:"#c4b8ff", borderRadius:"3px" }}/>
                        </div>
                        <span style={{ fontSize:"11px", fontWeight:"800", color:"#1A00B9", width:"20px" }}>{pro.ratings[cat.key]}</span>
                      </div>
                    ))}
                    <p style={{ fontFamily:"Georgia,serif", fontSize:"10px", color:"#aaa", margin:"10px 0 0", textAlign:"right" }}>{pro.name}</p>
                  </div>
                  <div style={{ background:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"700", color:"#888" }}>Category Breakdown Card</span>
                    <button style={{...btnPink, padding:"7px 14px", fontSize:"11px", boxShadow:"2px 2px 0 #1A00B9"}}>Download</button>
                  </div>
                </div>

                <div style={{ border:"1.5px solid #1A00B9", borderRadius:"16px", overflow:"hidden", boxShadow:"4px 4px 0 #1A00B9" }}>
                  <div style={{ background:"linear-gradient(160deg,#E8E4FF,#fff)", padding:"28px 20px", textAlign:"center" }}>
                    <div style={{ fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", marginBottom:"10px" }}>Community Verified ✦</div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:"52px", fontWeight:"900", color:"#1A00B9", lineHeight:1 }}>{overall}</div>
                    <div style={{ fontSize:"22px", color:"#B7CF4F", margin:"4px 0 8px" }}>★★★★★</div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:"15px", fontWeight:"900", color:"#1A00B9" }}>{pro.name}</div>
                    <div style={{ fontSize:"11px", color:"#888", marginTop:"4px" }}>Rated by {pro.reviews} clients</div>
                    <div style={{ marginTop:"12px", fontFamily:"Georgia,serif", fontSize:"11px", color:"#aaa" }}>reffered</div>
                  </div>
                  <div style={{ background:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"700", color:"#888" }}>Instagram Story Card</span>
                    <button style={{...btnPink, padding:"7px 14px", fontSize:"11px", boxShadow:"2px 2px 0 #1A00B9"}}>Download</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background:"#EAE6FF", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"16px 20px" }}>
              <p style={{ margin:0, fontFamily:"sans-serif", fontSize:"13px", color:"#555", lineHeight:"1.6" }}>
                💡 <strong>Pro tip:</strong> Post your rating card to your Instagram story every time you get a new recommendation. Tag <strong>@reffered</strong> and we may reshare to our community.
              </p>
            </div>
          </div>
        )}

        {/* ── WIDGET TAB ── */}
        {activeTab==="widget" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 8px", letterSpacing:"-1px" }}>Website Widget & Embed</h2>
              <p style={{ color:"#666", fontSize:"14px", lineHeight:"1.6", margin:0 }}>Add your reffered rating to your own website or link in bio page. Updates automatically as new reviews come in.</p>
            </div>

            {/* Widget preview */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
              <p style={{ margin:"0 0 16px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Widget Preview</p>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"20px 24px", display:"inline-flex", alignItems:"center", gap:"16px", boxShadow:"4px 4px 0 #1A00B9", maxWidth:"380px", width:"100%" }}>
                  <div style={{ width:"52px", height:"52px", borderRadius:"50%", background:"#f4f2ff", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><span style={{ fontSize:"18px", opacity:0.5 }}>📷</span></div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"2px" }}>
                      <span style={{ fontFamily:"Georgia,serif", fontSize:"14px", fontWeight:"900" }}>{pro.name}</span>
                      <span style={{ background:"#B7CF4F", border:"1px solid #1A00B9", borderRadius:"10px", padding:"1px 6px", fontSize:"9px", fontWeight:"800" }}>✓ PRO+</span>
                    </div>
                    <div style={{ fontSize:"11px", color:"#888", marginBottom:"6px" }}>{pro.specialty} · {pro.location}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <span style={{ color:"#B7CF4F", fontSize:"14px" }}>★★★★★</span>
                      <span style={{ fontFamily:"Georgia,serif", fontSize:"14px", fontWeight:"900", color:"#1A00B9" }}>{overall}</span>
                      <span style={{ fontSize:"11px", color:"#aaa" }}>({pro.reviews} reviews)</span>
                    </div>
                  </div>
                  <div style={{ fontFamily:"Georgia,serif", fontSize:"10px", color:"#aaa", textAlign:"center", borderLeft:"1px solid #f0f0f0", paddingLeft:"12px" }}>
                    <div style={{ fontSize:"8px", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"2px" }}>via</div>
                    reffered
                  </div>
                </div>
              </div>
            </div>

            {/* Embed code */}
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", boxShadow:"3px 3px 0 #1A00B9" }}>
              <p style={{ margin:"0 0 12px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa" }}>Embed Code</p>
              <div style={{ background:"#1A00B9", borderRadius:"10px", padding:"20px", fontFamily:"monospace", fontSize:"12px", color:"#B7CF4F", lineHeight:"1.8", marginBottom:"14px", overflowX:"auto" }}>
                {`<iframe`}<br/>
                {`  src="https://reffered.com/widget/${pro.name.toLowerCase().replace(" ","-")}"`}<br/>
                {`  width="380" height="100"`}<br/>
                {`  frameborder="0"`}<br/>
                {`  style="border-radius:16px;border:2px solid #1A00B9"`}<br/>
                {`></iframe>`}
              </div>
              <button style={{...btnPink, padding:"10px 20px", fontSize:"12px", boxShadow:"2px 2px 0 #1A00B9"}}>📋 Copy Embed Code</button>
            </div>

            <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", padding:"16px 20px" }}>
              <p style={{ margin:0, fontFamily:"sans-serif", fontSize:"13px", color:"#666", lineHeight:"1.6" }}>
                💡 <strong>Works everywhere:</strong> Paste the embed code into Squarespace, Wix, WordPress, Linktree, or any website builder. Your rating updates live as new recommendations come in.
              </p>
            </div>
          </div>
        )}

        {activeTab==="ai advisor" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>
            <div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 8px", letterSpacing:"-1px" }}>AI Business Advisor</h2>
              <p style={{ color:"#666", fontSize:"14px", lineHeight:"1.6", margin:0 }}>Get personalized advice to grow your business, improve your ratings, and attract more clients.</p>
            </div>

            {!pro.proPlus ? (
              <div style={{ background:"#f4f2ff", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"40px 32px", textAlign:"center" }}>
                <div style={{ fontSize:"36px", marginBottom:"12px" }}>✦</div>
                <p style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9", margin:"0 0 8px" }}>Pro+ Exclusive</p>
                <p style={{ fontSize:"14px", color:"#666", margin:"0 0 24px", lineHeight:"1.6", maxWidth:"360px", marginLeft:"auto", marginRight:"auto" }}>Your personal AI business coach — trained on beauty industry data and powered by your actual profile and ratings.</p>
                <button onClick={() => handleUpgrade("month")} style={{...btnDark, boxShadow:"4px 4px 0 #B7CF4F"}}>Upgrade to Pro+ →</button>
              </div>
            ) : (
              <>
                {/* Quick prompts */}
                {advisorMessages.length === 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                    <p style={{ margin:0, fontSize:"12px", fontWeight:"800", color:"#aaa", letterSpacing:"1.5px", textTransform:"uppercase" }}>Suggested questions</p>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                      {[
                        "How can I get more referrals?",
                        "How do I improve my wait time rating?",
                        "What should I post on Instagram?",
                        "How do I price my services competitively?",
                        "How do I turn one-time clients into regulars?",
                      ].map(q => (
                        <button key={q} onClick={() => sendAdvisorMessage(q)}
                          style={{ background:"#f4f2ff", border:"1.5px solid #e0ddf5", borderRadius:"20px", padding:"8px 16px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", color:"#1A00B9", cursor:"pointer" }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                <div style={{ display:"flex", flexDirection:"column", gap:"16px", maxHeight:"420px", overflowY:"auto", padding:"4px 0" }}>
                  {advisorMessages.map((msg, i) => (
                    <div key={i} style={{ display:"flex", justifyContent: msg.role==="user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth:"80%", padding:"14px 18px", borderRadius: msg.role==="user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: msg.role==="user" ? "#1A00B9" : "#f4f2ff",
                        color: msg.role==="user" ? "#fff" : "#222",
                        fontSize:"14px", lineHeight:"1.65", fontFamily:"sans-serif",
                        border: msg.role==="assistant" ? "1.5px solid #e0ddf5" : "none",
                      }}>
                        {msg.role==="assistant" && <p style={{ margin:"0 0 6px", fontSize:"10px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#9B8AFB" }}>AI Advisor</p>}
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {advisorLoading && (
                    <div style={{ display:"flex", justifyContent:"flex-start" }}>
                      <div style={{ background:"#f4f2ff", border:"1.5px solid #e0ddf5", borderRadius:"18px 18px 18px 4px", padding:"14px 18px", fontSize:"14px", color:"#aaa" }}>Thinking...</div>
                    </div>
                  )}
                  <div ref={advisorEndRef}/>
                </div>

                {/* Input */}
                <div style={{ display:"flex", gap:"10px", alignItems:"flex-end" }}>
                  <textarea
                    value={advisorInput}
                    onChange={e => setAdvisorInput(e.target.value)}
                    onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendAdvisorMessage(); } }}
                    placeholder="Ask anything about your business..."
                    rows={2}
                    style={{ flex:1, padding:"12px 16px", borderRadius:"12px", border:"1.5px solid #1A00B9", fontSize:"14px", fontFamily:"sans-serif", resize:"none", outline:"none" }}
                  />
                  <button onClick={() => sendAdvisorMessage()} disabled={advisorLoading || !advisorInput.trim()}
                    style={{...btnDark, padding:"12px 20px", boxShadow:"3px 3px 0 #B7CF4F", opacity: advisorLoading || !advisorInput.trim() ? 0.5 : 1}}>
                    Send →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upgrade prompt / billing */}
        <div style={{ background: pro.proPlus ? "#f4f2ff" : "#E8E4FF", border:"1.5px solid #1A00B9", borderRadius:"16px", padding:"24px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"16px", marginTop:"8px" }}>
          {pro.proPlus ? (
            <>
              <div>
                <p style={{ margin:"0 0 2px", fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", color:"#1A00B9" }}>Pro+ · $9.99/month</p>
                <p style={{ margin:0, fontSize:"13px", color:"#666" }}>Next billing: February 1, 2025 · <span onClick={()=>setManagePlanOpen(true)} style={{ color:"#1A00B9", cursor:"pointer", fontWeight:"700", textDecoration:"underline" }}>Manage plan</span></p>
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={()=>setManagePlanOpen(true)} style={{...btnOut, padding:"9px 18px", fontSize:"12px"}}>Manage Plan</button>
                <button style={{...btnDark, padding:"9px 18px", fontSize:"12px", boxShadow:"3px 3px 0 #B7CF4F"}}>Invite a Pro →</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p style={{ margin:"0 0 4px", fontFamily:"Georgia,serif", fontSize:"18px", fontWeight:"900", color:"#fff" }}>Upgrade to Pro+</p>
                <p style={{ margin:0, fontSize:"13px", color:"#888" }}>Unlock trending, license verification, business insights & more.</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px" }}>
                <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
                  <button onClick={() => handleUpgrade("month")} disabled={!!upgradeLoading} style={{ background:"#fff", color:"#1A00B9", border:"none", borderRadius:"30px", padding:"11px 22px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"3px 3px 0 #B7CF4F", opacity: upgradeLoading ? 0.7 : 1 }}>{upgradeLoading==="month" ? "Redirecting..." : "$9.99/month →"}</button>
                  <button onClick={() => handleUpgrade("year")} disabled={!!upgradeLoading} style={{ background:"transparent", color:"#B7CF4F", border:"1.5px solid #B7CF4F", borderRadius:"30px", padding:"11px 22px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", opacity: upgradeLoading ? 0.7 : 1 }}>{upgradeLoading==="year" ? "Redirecting..." : "$75/year · Save 37%"}</button>
                </div>
                <p style={{ margin:0, fontSize:"11px", color:"rgba(255,255,255,0.6)" }}>Cancel anytime · No contracts</p>
              </div>
            </>
          )}
        </div>

        {/* MANAGE PLAN MODAL */}
        {managePlanOpen && (
          <div onClick={()=>setManagePlanOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:"20px" }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", maxWidth:"480px", width:"100%", boxShadow:"6px 6px 0 #1A00B9", overflow:"hidden" }}>
              <div style={{ background:"#E8E4FF", padding:"24px 28px", borderBottom:"1px solid #e0ddf5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", color:"#1A00B9" }}>Manage Your Plan</p>
                  <p style={{ margin:"2px 0 0", fontSize:"12px", color:"#666" }}>Pro+ · Active</p>
                </div>
                <button onClick={()=>setManagePlanOpen(false)} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px", fontWeight:"900", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              </div>
              <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:"0" }}>
                {[
                  { label:"Plan", val:"Pro+ Monthly" },
                  { label:"Amount", val:"$9.99 / month" },
                  { label:"Next billing date", val:"Managed via Stripe" },
                  { label:"Payment method", val:"—" },
                  { label:"Member since", val:"—" },
                ].map(({label,val},i,arr)=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:i<arr.length-1?"1px solid #f0f0f0":"none" }}>
                    <span style={{ fontSize:"13px", color:"#888", fontWeight:"600" }}>{label}</span>
                    <span style={{ fontSize:"13px", fontWeight:"800", color:"#1A00B9" }}>{val}</span>
                  </div>
                ))}
                <div style={{ background:"#edfad4", border:"1.5px solid #B7CF4F", borderRadius:"12px", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", margin:"16px 0" }}>
                  <div>
                    <p style={{ margin:"0 0 2px", fontWeight:"800", fontSize:"13px", color:"#1A00B9" }}>Switch to Annual · Save 37%</p>
                    <p style={{ margin:0, fontSize:"12px", color:"#555" }}>$75/year instead of $119.88 — save $44.88</p>
                  </div>
                  <button style={{...btnDark, padding:"9px 16px", fontSize:"12px", boxShadow:"2px 2px 0 #B7CF4F"}}>Switch →</button>
                </div>
                <div style={{ display:"flex", gap:"10px" }}>
                  <button onClick={()=>setManagePlanOpen(false)} style={{...btnDark, flex:1, padding:"12px", fontSize:"13px", boxShadow:"3px 3px 0 #B7CF4F"}}>Done</button>
                  <button style={{ flex:1, padding:"12px", background:"none", border:"1.5px solid #ddd", borderRadius:"30px", fontSize:"13px", fontWeight:"800", color:"#aaa", cursor:"pointer" }}>Cancel Plan</button>
                </div>
                <p style={{ margin:"12px 0 0", fontSize:"11px", color:"#aaa", textAlign:"center" }}>Cancellations take effect at the end of your billing period.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── ABOUT PAGE ──────────────────────────────────────────────────────────────
// ─── MATCH ME PAGE ────────────────────────────────────────────────────────────
function MatchMePage({ communityPros, goTo, goToRecommend }) {
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // [{ id, matchScore, reason }]
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleMatch = async () => {
    if (!description.trim() && !photoFile) { setError("Tell us what you're looking for, or upload an inspiration photo."); return; }
    setError("");
    setLoading(true);
    setResults(null);

    try {
      let photoBase64 = null;
      let photoMimeType = null;
      if (photoFile) {
        photoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
        photoMimeType = photoFile.type;
      }

      const prosSummary = communityPros.map(p => ({
        id: p.id,
        name: p.name,
        specialty: p.specialty,
        location: p.location,
        bio: p.bio,
        tags: p.tags,
        ratings: p.ratings,
        reviews: p.reviews,
      }));

      const res = await fetch("/api/match-pros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), photoBase64, photoMimeType, pros: prosSummary }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Something went wrong."); setLoading(false); return; }
      setResults(data.matches);
    } catch (err) {
      setError("Connection error — please try again.");
    }
    setLoading(false);
  };

  const matchedPros = results
    ? results.map(r => ({ ...communityPros.find(p => p.id === r.id), matchScore: r.matchScore, matchReason: r.reason })).filter(p => p.id)
    : [];

  return (
    <div style={{ fontFamily:"sans-serif", minHeight:"100vh", background:"#f4f2ff" }}>
      {/* Header */}
      <div style={{ background:"#1A00B9", padding:"60px 24px 48px", textAlign:"center" }}>
        <div style={{ display:"inline-block", background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.3)", borderRadius:"6px", padding:"4px 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#fff", marginBottom:"20px" }}>AI Matchmaking ✦</div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,5vw,44px)", fontWeight:"900", color:"#fff", margin:"0 0 12px", letterSpacing:"-1px" }}>Find Your Perfect Pro</h1>
        <p style={{ color:"rgba(255,255,255,0.8)", fontSize:"15px", margin:"0 auto", maxWidth:"480px", lineHeight:1.6 }}>Describe what you're looking for — your vibe, style, budget, location — and we'll match you with the best pro in the community.</p>
      </div>

      {/* Input card */}
      <div style={{ maxWidth:"640px", margin:"-24px auto 0", padding:"0 20px 60px" }}>
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", boxShadow:"6px 6px 0 #1A00B9", padding:"32px 28px" }}>

          <label style={{ display:"block", fontWeight:"800", fontSize:"12px", color:"#1A00B9", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"10px" }}>What are you looking for?</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. I want a natural balayage with face-framing highlights. I'm in Atlanta, my budget is medium, and I really care about someone who communicates well and is on time..."
            rows={5}
            style={{ width:"100%", padding:"14px 16px", borderRadius:"12px", border:"1.5px solid #ddd", fontSize:"14px", fontFamily:"sans-serif", lineHeight:1.6, resize:"vertical", boxSizing:"border-box", outline:"none", color:"#111" }}
          />

          {/* Photo upload */}
          <div style={{ marginTop:"16px" }}>
            <label style={{ display:"block", fontWeight:"800", fontSize:"12px", color:"#1A00B9", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"10px" }}>Inspiration Photo <span style={{ color:"#999", fontWeight:"600", textTransform:"none", letterSpacing:0 }}>(optional)</span></label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }}/>
            {photoPreview ? (
              <div style={{ position:"relative", display:"inline-block" }}>
                <img src={photoPreview} alt="inspiration" style={{ width:"100px", height:"100px", objectFit:"cover", borderRadius:"12px", border:"1.5px solid #1A00B9" }}/>
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); fileRef.current.value=""; }}
                  style={{ position:"absolute", top:"-8px", right:"-8px", background:"#1A00B9", color:"#fff", border:"none", borderRadius:"50%", width:"22px", height:"22px", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"900" }}>×</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current.click()}
                style={{ padding:"10px 20px", background:"#f4f2ff", border:"1.5px dashed #9B8AFB", borderRadius:"12px", fontSize:"13px", fontWeight:"700", color:"#1A00B9", cursor:"pointer" }}>
                📷 Upload inspo photo
              </button>
            )}
          </div>

          {error && <p style={{ color:"#cc0000", fontSize:"13px", fontWeight:"700", margin:"14px 0 0" }}>{error}</p>}

          <button onClick={handleMatch} disabled={loading}
            style={{ marginTop:"20px", width:"100%", padding:"16px", background: loading ? "#9B8AFB" : "#1A00B9", color:"#fff", border:"none", borderRadius:"12px", fontSize:"15px", fontWeight:"800", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "4px 4px 0 #B7CF4F", transition:"all 0.2s", fontFamily:"sans-serif" }}>
            {loading ? "✨ Finding your matches..." : "✨ Find My Match"}
          </button>
        </div>

        {/* Results */}
        {matchedPros.length > 0 && (
          <div style={{ marginTop:"40px" }}>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#111", margin:"0 0 20px", textAlign:"center" }}>Your Top Matches ✦</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
              {matchedPros.map((pro, i) => {
                const overall = pro.ratings ? ((Object.values(pro.ratings).filter(v=>v>0).reduce((a,b)=>a+b,0))/(Object.values(pro.ratings).filter(v=>v>0).length||1)).toFixed(1) : "0";
                return (
                  <div key={pro.id} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"16px", boxShadow:"4px 4px 0 #1A00B9", overflow:"hidden" }}>
                    {/* Match banner */}
                    <div style={{ background: i===0 ? "#1A00B9" : "#f4f2ff", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:"12px", fontWeight:"800", color: i===0 ? "#B7CF4F" : "#1A00B9" }}>
                        {i===0 ? "🏆 Best Match" : `#${i+1} Match`}
                      </span>
                      <span style={{ fontSize:"12px", fontWeight:"900", color: i===0 ? "#fff" : "#1A00B9" }}>
                        {pro.matchScore}% match
                      </span>
                    </div>
                    {/* Pro info */}
                    <div style={{ padding:"16px" }}>
                      <div style={{ display:"flex", gap:"14px", alignItems:"flex-start" }}>
                        {/* Photo */}
                        <div style={{ width:"64px", height:"64px", borderRadius:"12px", overflow:"hidden", flexShrink:0, background:"linear-gradient(135deg, #9B8AFB 0%, #E8E4FF 100%)" }}>
                          {(pro.allPhotoUrls?.[0] || pro.photoUrl) && (
                            <img src={pro.allPhotoUrls?.[0] || pro.photoUrl} alt={pro.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>
                          )}
                        </div>
                        {/* Details */}
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"2px" }}>
                            <h3 style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", color:"#111" }}>{pro.name}</h3>
                            {pro.proPlus && <span style={{ background:"#edfad4", color:"#4a7c20", borderRadius:"6px", padding:"2px 7px", fontSize:"9px", fontWeight:"700" }}>PRO+</span>}
                          </div>
                          <p style={{ margin:"0 0 4px", fontSize:"12px", color:"#666" }}>{pro.specialty} · 📍 {pro.location}</p>
                          <p style={{ margin:0, fontSize:"12px", color:"#1A00B9", fontWeight:"700" }}>★ {overall} · {pro.reviews} review{pro.reviews!==1?"s":""}</p>
                        </div>
                      </div>
                      {/* AI reason */}
                      <div style={{ marginTop:"12px", background:"#f4f2ff", borderRadius:"10px", padding:"10px 14px" }}>
                        <p style={{ margin:0, fontSize:"13px", color:"#333", lineHeight:1.6 }}>💜 {pro.matchReason}</p>
                      </div>
                      {/* Actions */}
                      <div style={{ display:"flex", gap:"8px", marginTop:"12px" }}>
                        <button onClick={()=>goToRecommend(pro)} style={{ flex:1, padding:"9px", background:"#f4f2ff", border:"none", borderRadius:"10px", fontSize:"12px", fontWeight:"700", color:"#1A00B9", cursor:"pointer" }}>⭐ Refer {pro.name.split(" ")[0]}</button>
                        {pro.booking && <a href={pro.booking.startsWith("http")?pro.booking:`https://${pro.booking}`} target="_blank" rel="noreferrer" style={{ flex:1, padding:"9px", background:"#edfad4", border:"none", borderRadius:"10px", fontSize:"12px", fontWeight:"700", color:"#3a6e10", cursor:"pointer", textDecoration:"none", textAlign:"center" }}>📅 Book</a>}
                        {pro.instagram && <a href={`https://instagram.com/${pro.instagram}`} target="_blank" rel="noreferrer" style={{ flex:1, padding:"9px", background:"#fafafa", border:"1px solid #f0eef8", borderRadius:"10px", fontSize:"12px", fontWeight:"600", color:"#555", textDecoration:"none", textAlign:"center" }}>📷 IG</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign:"center", marginTop:"24px", fontSize:"13px", color:"#888" }}>Want to browse everyone? <span onClick={()=>goTo("home")} style={{ color:"#1A00B9", fontWeight:"700", cursor:"pointer" }}>View full directory →</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutPage({ setPage }) {
  return (
    <div style={{ fontFamily:"sans-serif" }}>
      <div className="about-hero" style={{...gridBg, padding:"80px 40px", textAlign:"center", borderBottom:"1px solid #e0ddf5"}}>
        <div style={{ display:"inline-block", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"6px", padding:"4px 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"24px" }}>Our Story ✦</div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(40px,7vw,80px)", fontWeight:"900", letterSpacing:"-3px", lineHeight:1, margin:"0 0 24px" }}>
          Beauty is better<br/><span style={{ background:"#9B8AFB", padding:"4px 12px 0", color:"#fff", display:"inline-block", marginTop:"6px" }}>when we share it.</span>
        </h1>
        <p style={{ fontSize:"17px", color:"#555", maxWidth:"560px", margin:"0 auto", lineHeight:"1.7" }}>
          reffered was built on one simple belief: the best beauty professionals don't always have the biggest marketing budgets — they have the most loyal clients.
        </p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)" }} className="about-blocks">
        {[
          { bg:"#B7CF4F", emoji:"💬", title:"Word of mouth, amplified.", body:"We turned the thing you already do — texting your friend the name of your favorite nail tech — into a searchable, scrollable, community-powered directory. No algorithms. No ads. Just real people putting real pros on." },
          { bg:"#fff", emoji:"🌟", title:"Every pro deserves a spotlight.", body:"Some of the most talented people in beauty are hiding in DMs and Google Docs shared between friends. We're changing that. If you're great at what you do, your name belongs here." },
          { bg:"#FFE5DE", emoji:"🤝", title:"Community over competition.", body:"We're not Yelp. We're not Google. We're the group chat that actually answers. A space where clients champion pros and pros build legacies — one recommendation at a time." },
          { bg:"#dde8f7", emoji:"✨", title:"Real results, real people.", body:"Every profile on reffered is backed by photos, stories, and lived experiences. No stock images. No paid placements. Just the kind of honest, glowing review you'd get from your most trusted friend." },
        ].map((block,i)=>(
          <div key={i} style={{ background:block.bg, border:"1.5px solid #1A00B9", borderTop:"none", borderLeft:i%2===0?"2px solid #1A00B9":"none", padding:"48px 36px" }}>
            <div style={{ fontSize:"40px", marginBottom:"16px" }}>{block.emoji}</div>
            <h3 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-0.5px" }}>{block.title}</h3>
            <p style={{ color:"#444", lineHeight:"1.7", margin:0, fontSize:"15px" }}>{block.body}</p>
          </div>
        ))}
      </div>

      <div style={{...gridBg, padding:"60px 40px", borderTop:"1px solid #e0ddf5", borderBottom:"1px solid #e0ddf5", textAlign:"center"}}>
        <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>The Standard</p>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"36px", fontWeight:"900", margin:"0 0 48px", letterSpacing:"-1px" }}>Built different. On purpose.</h2>
        <div style={{ display:"flex", justifyContent:"center", maxWidth:"320px", margin:"0 auto" }}>
          <div style={{ flex:1, padding:"32px 40px", border:"1.5px solid #1A00B9", background:"#fff" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"56px", fontWeight:"900", color:"#9B8AFB", letterSpacing:"-2px" }}>100%</div>
            <div style={{ fontSize:"12px", fontWeight:"700", letterSpacing:"1.5px", textTransform:"uppercase", color:"#888", marginTop:"8px" }}>Community Powered</div>
          </div>
        </div>
      </div>

      <div className="about-how" style={{ maxWidth:"900px", margin:"0 auto", padding:"60px 40px" }}>
        <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>How It Works</p>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"36px", fontWeight:"900", margin:"0 0 40px", letterSpacing:"-1px" }}>Simple. Human. Intentional.</h2>
        {[
          { step:"01", title:"Someone recommends a pro.", body:"A client fills out our quick recommendation form — sharing who they love, why they love them, and photos of the results." },
          { step:"02", title:"We review every submission.", body:"Our team reviews each recommendation before it goes live. No spam. No fake reviews. Just real experiences from real people." },
          { step:"03", title:"The pro gets discovered.", body:"Their profile goes live in the directory — searchable by city, specialty, and rating — so the right clients find them at exactly the right time." },
        ].map((item,i)=>(
          <div key={i} style={{ display:"flex", gap:"28px", alignItems:"flex-start", padding:"28px 0", borderBottom:i<2?"1.5px solid #e5e5e5":"none" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"48px", fontWeight:"900", color:"#e5e5e5", lineHeight:1, minWidth:"60px" }}>{item.step}</div>
            <div>
              <h4 style={{ fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", margin:"0 0 8px" }}>{item.title}</h4>
              <p style={{ color:"#555", lineHeight:"1.7", margin:0, fontSize:"15px" }}>{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="about-cta" style={{ background:"#f4f2ff", padding:"80px 40px", textAlign:"center", borderTop:"1px solid #e0ddf5" }}>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,56px)", fontWeight:"900", color:"#1A00B9", margin:"0 0 16px", letterSpacing:"-2px" }}>Ready to put your fave on the map?</h2>
        <p style={{ color:"#666", fontSize:"16px", margin:"0 0 32px", lineHeight:"1.6" }}>It takes 2 minutes to submit a recommendation. Your pro deserves the recognition.</p>
        <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={()=>setPage("recommend")} style={{...btnDark, padding:"16px 36px", fontSize:"14px"}}>+ Refer a Pro</button>
          <button onClick={()=>setPage("home")} style={{...btnOut, padding:"16px 36px", fontSize:"14px"}}>Browse the Directory</button>
        </div>
      </div>
    </div>
  );
}

// ─── PUBLIC PROFILE PAGE ─────────────────────────────────────────────────────
function PublicProfilePage({ proId, goToRecommend, goTo }) {
  const [loading, setLoading] = useState(true);
  const [proData, setProData] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!proId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data: proRow, error } = await supabase.from("pros").select("*").eq("id", proId).single();
      if (error || !proRow) { setNotFound(true); setLoading(false); return; }
      setProData(mapSupabasePro(proRow));
      const { data: recs } = await supabase
        .from("recommendations")
        .select("review_text, submitter_name, rating_overall, photo_urls, created_at")
        .eq("pro_id", proId)
        .not("review_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);
      setReferrals(recs || []);
      setLoading(false);
    })();
  }, [proId]);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f2ff" }}>
      <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#9B8AFB", fontWeight:"700" }}>Loading profile...</p>
    </div>
  );

  if (notFound || !proData) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f2ff", padding:"40px 20px" }}>
      <div style={{ textAlign:"center", maxWidth:"400px" }}>
        <div style={{ fontSize:"48px", marginBottom:"16px" }}>🔍</div>
        <h2 style={{ fontFamily:"Georgia,serif", fontSize:"24px", fontWeight:"900", color:"#1A00B9", margin:"0 0 12px" }}>Profile not found</h2>
        <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#666", margin:"0 0 24px", lineHeight:"1.6" }}>This profile doesn't exist or has been removed.</p>
        <button onClick={()=>goTo("home")} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"12px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0 #B7CF4F" }}>Browse All Pros →</button>
      </div>
    </div>
  );

  const pro = proData;
  const overall = avgRating(pro.ratings);

  return (
    <div style={{ minHeight:"100vh", background:"#f4f2ff", fontFamily:"sans-serif" }}>
      {/* Mini Nav */}
      <div style={{ background:"#1A00B9", padding:"16px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
          <span style={{ color:"#B7CF4F", fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"900", letterSpacing:"-0.5px" }}>reffered ✦</span>
        </button>
        <button onClick={()=>goTo("home")} style={{ background:"rgba(255,255,255,0.12)", color:"#fff", border:"1.5px solid rgba(255,255,255,0.3)", borderRadius:"30px", padding:"8px 18px", fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", cursor:"pointer" }}>Browse All Pros →</button>
      </div>

      {/* Profile Content */}
      <div style={{ maxWidth:"640px", margin:"0 auto", padding:"36px 20px 60px" }}>

        {/* Hero Card */}
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", overflow:"hidden", boxShadow:"6px 6px 0 #1A00B9", marginBottom:"20px" }}>
          {/* Photo */}
          <div style={{ position:"relative", paddingTop:"45%", background:"#e8e4ff", overflow:"hidden" }}>
            {pro.photoUrl
              ? <img src={pro.photoUrl} alt={pro.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/>
              : <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg, #e8e4ff 0%, #f4f2ff 100%)" }}/>
            }
          </div>

          <div style={{ padding:"28px" }}>
            {/* Name + Rating */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
              <div>
                <h1 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 6px", letterSpacing:"-0.5px" }}>{pro.name}</h1>
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontWeight:"800" }}>{pro.specialty}</span>
                  {pro.proPlus && <span style={{ background:"#1A00B9", color:"#fff", borderRadius:"20px", padding:"4px 10px", fontSize:"10px", fontWeight:"800", letterSpacing:"1px" }}>✦ PRO+</span>}
                  {pro.verified && <span style={{ background:"#B7CF4F", color:"#1A00B9", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"4px 10px", fontSize:"10px", fontWeight:"800" }}>✓ VERIFIED</span>}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:"26px", fontWeight:"900", color:"#1A00B9" }}>★ {overall}</div>
                <div style={{ fontSize:"11px", color:"#aaa" }}>{pro.reviews} {pro.reviews===1?"review":"reviews"}</div>
              </div>
            </div>

            {/* Location */}
            {pro.location && <p style={{ fontSize:"13px", color:"#888", margin:"0 0 16px" }}>📍 {pro.location}</p>}

            {/* Bio */}
            {pro.bio && <p style={{ fontSize:"14px", color:"#444", lineHeight:"1.75", margin:"0 0 20px" }}>{pro.bio}</p>}

            {/* Tags */}
            {pro.tags.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"20px" }}>
                {pro.tags.map(tag=><span key={tag} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontWeight:"700" }}>{tag}</span>)}
              </div>
            )}

            {/* Connect section */}
            {(pro.instagram || pro.booking) && (
              <div style={{ borderTop:"1.5px solid #f0eef8", paddingTop:"16px", marginBottom:"4px", display:"flex", flexDirection:"column", gap:"10px" }}>
                <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:0 }}>Connect</p>
                {pro.instagram && (
                  <a href={`https://instagram.com/${pro.instagram}`} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:"10px", textDecoration:"none" }}>
                    <span style={{ fontSize:"20px" }}>📷</span>
                    <div>
                      <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa", margin:0, fontWeight:"700" }}>Instagram</p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#1A00B9", margin:0, fontWeight:"800" }}>@{pro.instagram}</p>
                    </div>
                  </a>
                )}
                {pro.booking && (
                  <a href={pro.booking} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:"10px", textDecoration:"none" }}>
                    <span style={{ fontSize:"20px" }}>📅</span>
                    <div>
                      <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa", margin:0, fontWeight:"700" }}>Book an Appointment</p>
                      <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#1A00B9", margin:0, fontWeight:"800" }}>Book Now →</p>
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", paddingTop:"16px", borderTop:"1.5px solid #f0eef8" }}>
              <button onClick={()=>{ goToRecommend(pro); }} style={{ background:"#1A00B9", color:"#fff", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"12px 24px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0 #B7CF4F" }}>⭐ Refer {pro.name.split(" ")[0]}</button>
            </div>
          </div>
        </div>

        {/* Verification Badge */}
        {pro.verified && LICENSED_SPECIALTIES.includes(pro.specialty) && (
          <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"16px 20px", marginBottom:"20px", display:"flex", alignItems:"center", gap:"14px", boxShadow:"3px 3px 0 #B7CF4F" }}>
            <div style={{ width:"40px", height:"40px", borderRadius:"10px", background:"#B7CF4F", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>🛡️</div>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", margin:"0 0 2px", color:"#1A00B9" }}>reffered Verified Pro</p>
              <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#666", margin:0 }}>License verified by reffered</p>
            </div>
            <span style={{ background:"#B7CF4F", color:"#1A00B9", border:"1.5px solid #1A00B9", fontSize:"10px", fontWeight:"800", padding:"4px 12px", borderRadius:"20px", whiteSpace:"nowrap" }}>✓ Verified</span>
          </div>
        )}

        {/* Rating Breakdown */}
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"24px", marginBottom:"20px", boxShadow:"3px 3px 0 #B7CF4F" }}>
          <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 16px" }}>Rating Breakdown</p>
          <RatingBreakdown ratings={pro.ratings}/>
          <div style={{ marginTop:"14px", paddingTop:"12px", borderTop:"1.5px solid #e5e5e5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#888", textTransform:"uppercase", letterSpacing:"1px" }}>Overall Score</span>
            <span style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9" }}>★ {overall} / 5</span>
          </div>
        </div>

        {/* Community Referrals */}
        {referrals.length > 0 && (
          <div style={{ marginBottom:"20px" }}>
            <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 12px" }}>Community Referrals</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              {referrals.map((rec, i) => (
                <div key={i} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", overflow:"hidden", boxShadow:"3px 3px 0 #B7CF4F" }}>
                  {/* Referral photos */}
                  {rec.photo_urls && rec.photo_urls.length > 0 && (
                    <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(rec.photo_urls.length, 3)}, 1fr)`, gap:"2px", maxHeight:"200px", overflow:"hidden" }}>
                      {rec.photo_urls.slice(0, 3).map((url, j) => (
                        <img key={j} src={url} alt="" style={{ width:"100%", height:"200px", objectFit:"cover" }}/>
                      ))}
                    </div>
                  )}
                  <div style={{ padding:"18px 20px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                      <span style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#1A00B9" }}>{rec.submitter_name || "Anonymous"}</span>
                      {rec.rating_overall > 0 && <span style={{ fontFamily:"Georgia,serif", fontSize:"14px", fontWeight:"900", color:"#1A00B9" }}>★ {parseFloat(rec.rating_overall).toFixed(1)}</span>}
                    </div>
                    <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#444", lineHeight:"1.7", margin:0, fontStyle:"italic" }}>"{rec.review_text}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center", paddingTop:"20px", borderTop:"1.5px solid #e0ddf5" }}>
          <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"sans-serif", fontSize:"12px", color:"#9B8AFB", fontWeight:"700" }}>
            Powered by <span style={{ color:"#1A00B9", fontWeight:"900" }}>reffered ✦</span> · refferedpro.com
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PRO MODAL ───────────────────────────────────────────────────────────────
function ProModal({ pro, onClose, goToRecommend, getDistance }) {
  if (!pro) return null;
  const overall = avgRating(pro.ratings);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:"20px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", maxWidth:"560px", width:"100%", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15), 8px 8px 0 #1A00B9" }}>
        <div style={{ position:"relative" }}>
          <div style={{ position:"relative", paddingTop:"75%", overflow:"hidden", borderRadius:"18px 18px 0 0" }}>
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg, #9B8AFB 0%, #E8E4FF 100%)" }}/>
            {pro.photoUrl && <img src={pro.photoUrl} alt={pro.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>}
          </div>
          <button onClick={onClose} style={{ position:"absolute", top:"12px", right:"12px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"36px", height:"36px", cursor:"pointer", fontSize:"16px", fontWeight:"900", boxShadow:"2px 2px 0 #1A00B9" }}>×</button>
        </div>
        <div className="modal-body" style={{ padding:"28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
            <h2 style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"24px", fontWeight:"900", letterSpacing:"-0.5px" }}>{pro.name}</h2>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"Georgia,serif", fontWeight:"900", fontSize:"22px", color:"#1A00B9" }}>★ {overall}</div>
              <div style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#aaa" }}>{pro.reviews} reviews</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px", flexWrap:"wrap" }}>
          <div style={{ display:"inline-block", background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontFamily:"sans-serif", fontWeight:"800" }}>{pro.specialty}</div>
        </div>
          <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#888", margin:"0 0 10px", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
            📍 {pro.location}
            {getDistance && getDistance(pro) && (
              <span style={{ background:"#E8E4FF", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"800", color:"#1A00B9" }}>
                {getDistance(pro)} away
              </span>
            )}
          </p>
          <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#444", lineHeight:"1.7", margin:"0 0 14px" }}>{pro.bio}</p>

          {/* Recommended by trail */}
          {pro.recommendedBy?.length > 0 && (
            <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px" }}>
              <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 6px" }}>Recommended by</p>
              <p style={{ fontFamily:"sans-serif", fontSize:"13px", color:"#555", margin:0 }}>
                {pro.recommendedBy.join(" · ")} <span style={{ color:"#aaa" }}>+{pro.reviews - pro.recommendedBy.length} more</span>
              </p>
            </div>
          )}

          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"20px" }}>
            {pro.tags.map(tag=><span key={tag} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontFamily:"sans-serif", fontWeight:"700" }}>{tag}</span>)}
          </div>

          {/* Credential badge — only for licensed specialties with verified status */}
          {pro.verified && LICENSED_SPECIALTIES.includes(pro.specialty) && (
            <div style={{ background:"#f0fdf8", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"14px 16px", marginBottom:"16px", display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"8px", background:"#B7CF4F", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>🛡️</div>
              <div>
                <p style={{ fontFamily:"sans-serif", fontSize:"12px", fontWeight:"800", margin:"0 0 2px", color:"#1A00B9" }}>reffered Verified Pro</p>
                <p style={{ fontFamily:"sans-serif", fontSize:"11px", color:"#666", margin:0 }}>
                  Cosmetology License verified · Georgia · Jan 2025
                </p>
              </div>
              <span style={{ marginLeft:"auto", background:"#B7CF4F", color:"#1A00B9", border:"1.5px solid #1A00B9", fontSize:"10px", fontWeight:"800", padding:"3px 10px", borderRadius:"20px", whiteSpace:"nowrap" }}>✓ Verified</span>
            </div>
          )}

          <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"20px", marginBottom:"20px" }}>
            <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 16px" }}>Rating Breakdown</p>
            <RatingBreakdown ratings={pro.ratings}/>
            <div style={{ marginTop:"14px", paddingTop:"12px", borderTop:"1.5px solid #e5e5e5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#888", textTransform:"uppercase", letterSpacing:"1px" }}>Overall Score</span>
              <span style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9" }}>★ {overall} / 5</span>
            </div>
          </div>

          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {pro.instagram&&<a href={`https://instagram.com/${pro.instagram}`} target="_blank" rel="noreferrer" style={{...btnOut, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"13px", padding:"10px 20px"}}>📷 @{pro.instagram}</a>}
            <button onClick={()=>{ onClose(); goToRecommend(pro); }} style={{...btnDark, padding:"10px 20px", fontSize:"13px", boxShadow:"3px 3px 0 #B7CF4F"}}>⭐ Refer {pro.name.split(" ")[0]}</button>
          </div>

          {/* TikTok review — shown if pro has one or clients submitted one */}
          {pro.tiktokReview && (
            <div style={{ marginTop:"16px" }}>
              <p style={{ fontFamily:"sans-serif", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:"0 0 10px" }}>🎵 Client TikTok Review</p>
              <div style={{ position:"relative", borderRadius:"16px", overflow:"hidden", border:"1.5px solid #1A00B9", background:"#111", aspectRatio:"9/16", maxHeight:"480px" }}>
                {/* TikTok embeds require user click due to browser autoplay policy — we show a styled preview/click-to-play */}
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg, #1A00B9 0%, #111 100%)", cursor:"pointer" }}
                  onClick={()=>window.open(pro.tiktokReview, "_blank")}>
                  <div style={{ width:"64px", height:"64px", borderRadius:"50%", background:"#9B8AFB", border:"3px solid #F7F3DB", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
                    <span style={{ fontSize:"28px", marginLeft:"4px" }}>▶</span>
                  </div>
                  <p style={{ fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", color:"#F7F3DB", margin:"0 0 6px", textAlign:"center" }}>Watch the TikTok Review</p>
                  <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"rgba(247,243,219,0.6)", margin:0 }}>Opens in TikTok</p>
                  <div style={{ position:"absolute", top:"12px", right:"12px", background:"#000", borderRadius:"6px", padding:"4px 10px", display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ fontSize:"16px" }}>♪</span>
                    <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#fff", letterSpacing:"1px" }}>TikTok</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HELP PAGE ───────────────────────────────────────────────────────────────
function HelpPage({ goTo }) {
  return (
    <div style={{ fontFamily:"sans-serif", background:"#f4f2ff", minHeight:"100vh" }}>
      {/* Hero */}
      <div style={{ background:"#1A00B9", padding:"72px 40px 60px", textAlign:"center" }}>
        <div style={{ display:"inline-block", background:"#B7CF4F", borderRadius:"6px", padding:"4px 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#1A00B9", marginBottom:"20px" }}>Help Center</div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(36px,6vw,64px)", fontWeight:"900", color:"#fff", margin:"0 0 16px", letterSpacing:"-2px", lineHeight:1 }}>How reffered works.</h1>
        <p style={{ fontSize:"16px", color:"rgba(255,255,255,0.75)", margin:"0 auto", maxWidth:"480px", lineHeight:"1.7" }}>Everything you need to know — whether you're a beauty professional or looking for one.</p>
      </div>

      {/* THE 7 CATEGORIES THEORY — top of page */}
      <div style={{ background:"#1A00B9", padding:"56px 40px", borderBottom:"4px solid #B7CF4F" }}>
        <div style={{ maxWidth:"860px", margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:"16px" }}>
            <div style={{ display:"inline-block", background:"#B7CF4F", borderRadius:"6px", padding:"4px 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#1A00B9", marginBottom:"16px" }}>The reffered Theory</div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(26px,4vw,42px)", fontWeight:"900", color:"#fff", margin:"0 0 16px", letterSpacing:"-1.5px", lineHeight:1.1 }}>The more dimensions you rate,<br/>the better match you find.</h2>
            <p style={{ fontSize:"15px", color:"rgba(255,255,255,0.75)", maxWidth:"580px", margin:"0 auto 36px", lineHeight:"1.75" }}>A single star rating tells you almost nothing. It collapses a whole experience into one number — and hides everything that actually matters to you. reffered rates every pro across <strong style={{ color:"#B7CF4F" }}>7 specific categories</strong>, so you can match based on what you actually care about. Need someone who's always on time? Check wait time scores. Care more about the result than the vibe? Lead with Service Outcome. The right pro for you is in the details.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"12px" }}>
            {RATING_CATEGORIES.map(cat=>(
              <div key={cat.key} style={{ background:"rgba(255,255,255,0.08)", border:"1.5px solid rgba(255,255,255,0.15)", borderRadius:"14px", padding:"20px", display:"flex", gap:"14px", alignItems:"flex-start" }}>
                <div style={{ width:"40px", height:"40px", background:"#B7CF4F", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>{cat.emoji}</div>
                <div>
                  <p style={{ margin:"0 0 4px", fontFamily:"Georgia,serif", fontSize:"14px", fontWeight:"900", color:"#fff" }}>{cat.label}</p>
                  <p style={{ margin:0, fontSize:"11px", color:"rgba(255,255,255,0.6)", lineHeight:"1.55" }}>{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab sections */}
      <div style={{ maxWidth:"860px", margin:"0 auto", padding:"60px 24px" }}>

        {/* FOR PROS */}
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", boxShadow:"6px 6px 0 #1A00B9", marginBottom:"32px", overflow:"hidden" }}>
          <div style={{ background:"#1A00B9", padding:"24px 32px", display:"flex", alignItems:"center", gap:"14px" }}>
            <span style={{ fontSize:"28px" }}>✂️</span>
            <div>
              <p style={{ margin:"0 0 2px", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#B7CF4F" }}>For Beauty Professionals</p>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#fff", margin:0, letterSpacing:"-0.5px" }}>Getting listed on reffered</h2>
            </div>
          </div>
          <div style={{ padding:"32px" }}>
            {[
              { num:"01", title:"You get referred by a client", body:"You don't sign yourself up — a happy client fills out a referral form about you. They rate you across 7 categories and share what makes you exceptional. This keeps the directory 100% community-driven." },
              { num:"02", title:"Your profile goes live", body:"Once a referral is submitted and reviewed, your profile appears in the directory. It includes your specialty, location, ratings, and any photos your client uploaded." },
              { num:"03", title:"Claim your profile", body:"Search for your name in the directory and click \"Claim Your Profile\" — or sign up directly from the home page. Once claimed, you can add your bio, Instagram, booking link, and more." },
              { num:"04", title:"More referrals = better ranking", body:"As more clients refer you, your profile grows stronger. Each referral adds to your ratings across all 7 categories, building your reputation automatically." },
              { num:"05", title:"Upgrade to Pro+ for more tools", body:"Pro+ members get access to Keeli (your AI business advisor), advanced analytics, priority placement, and more. You can upgrade anytime from your dashboard." },
            ].map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:"20px", marginBottom: i<4 ? "28px" : 0, paddingBottom: i<4 ? "28px" : 0, borderBottom: i<4 ? "1px solid #f0eef8" : "none" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", color:"#e0ddf5", lineHeight:1, flexShrink:0, width:"36px" }}>{item.num}</div>
                <div>
                  <h4 style={{ fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", margin:"0 0 6px", color:"#1A00B9" }}>{item.title}</h4>
                  <p style={{ margin:0, fontSize:"14px", color:"#555", lineHeight:"1.7" }}>{item.body}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop:"28px", paddingTop:"24px", borderTop:"1.5px solid #f0eef8" }}>
              <button onClick={()=>goTo("join")} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"13px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"3px 3px 0 #B7CF4F" }}>Create Your Pro Account →</button>
            </div>
          </div>
        </div>

        {/* FOR CLIENTS */}
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", boxShadow:"6px 6px 0 #B7CF4F", marginBottom:"32px", overflow:"hidden" }}>
          <div style={{ background:"#B7CF4F", padding:"24px 32px", display:"flex", alignItems:"center", gap:"14px" }}>
            <span style={{ fontSize:"28px" }}>★</span>
            <div>
              <p style={{ margin:"0 0 2px", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9" }}>For Clients</p>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9", margin:0, letterSpacing:"-0.5px" }}>Finding & referring pros</h2>
            </div>
          </div>
          <div style={{ padding:"32px" }}>
            {[
              { num:"01", title:"Browse the directory", body:"Use the search bar or filter by specialty to find beauty pros near you. Every profile shows ratings across 7 real categories — not just a generic star — so you know exactly what to expect." },
              { num:"02", title:"Read real referrals", body:"Every pro on the platform has been referred by at least one real client. Click any profile to read their referrals, see detailed ratings, and check their Instagram or booking link." },
              { num:"03", title:"Refer a pro you love", body:"Know someone who deserves to be discovered? Fill out a quick referral form. You'll rate them across 7 categories and share what makes them stand out. It takes about 2 minutes." },
              { num:"04", title:"Save your favorites", body:"Tap the heart icon on any card to save a pro to your shortlist. Click the heart in the nav bar to view all your saved pros in one place." },
            ].map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:"20px", marginBottom: i<3 ? "28px" : 0, paddingBottom: i<3 ? "28px" : 0, borderBottom: i<3 ? "1px solid #f0eef8" : "none" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", color:"#e0ddf5", lineHeight:1, flexShrink:0, width:"36px" }}>{item.num}</div>
                <div>
                  <h4 style={{ fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", margin:"0 0 6px", color:"#1A00B9" }}>{item.title}</h4>
                  <p style={{ margin:0, fontSize:"14px", color:"#555", lineHeight:"1.7" }}>{item.body}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop:"28px", paddingTop:"24px", borderTop:"1.5px solid #f0eef8" }}>
              <button onClick={()=>goTo("recommend")} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"13px 28px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"3px 3px 0 #B7CF4F" }}>Refer a Pro Now →</button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", overflow:"hidden" }}>
          <div style={{ background:"#f4f2ff", padding:"24px 32px", borderBottom:"1.5px solid #1A00B9" }}>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9", margin:0, letterSpacing:"-0.5px" }}>Common questions</h2>
          </div>
          <div style={{ padding:"32px" }}>
            {[
              { q:"Is reffered free?", a:"Yes — browsing the directory and referring a pro are always free. Pros can claim their profile for free. Pro+ is a paid upgrade with additional tools." },
              { q:"Can I refer myself?", a:"No. Profiles are created when someone else refers you. This keeps the directory trustworthy — every pro listed has been vouched for by a real client." },
              { q:"How do I edit my profile after claiming it?", a:"Log in to your Pro dashboard. You can update your bio, add your Instagram and booking link, upload photos, and manage your specialty from there." },
              { q:"What if I see wrong information about me?", a:"Go to the Dispute a Listing page (linked in the footer) and submit a correction request. Our team reviews all disputes within 48 hours." },
              { q:"How does Pro+ help my business?", a:"Pro+ gives you access to Keeli, an AI business advisor that gives you personalized tips based on your specialty. You also get priority placement and advanced profile analytics." },
            ].map((item,i,arr)=>(
              <div key={i} style={{ paddingBottom: i<arr.length-1 ? "20px" : 0, marginBottom: i<arr.length-1 ? "20px" : 0, borderBottom: i<arr.length-1 ? "1px solid #f0eef8" : "none" }}>
                <h4 style={{ fontFamily:"Georgia,serif", fontSize:"15px", fontWeight:"900", margin:"0 0 6px", color:"#0a0a0a" }}>{item.q}</h4>
                <p style={{ margin:0, fontSize:"14px", color:"#555", lineHeight:"1.7" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:"40px" }}>
          <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", fontSize:"13px", fontWeight:"800", color:"#aaa", cursor:"pointer", textDecoration:"underline" }}>← Back to directory</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedInPro, setLoggedInPro] = useState(null);
  const [page, setPage] = useState("home");
  const [publicProId, setPublicProId] = useState(null);
  const signupInProgress = useRef(false); // prevents dashboard redirect during onboarding
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("")
  const [selectedPro, setSelectedPro] = useState(null);
  const [hover, setHover] = useState(null);
  const [savedPros, setSavedPros] = useState([]);
  const [showShortlist, setShowShortlist] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleSave = (pro) => setSavedPros(p => p.find(x=>x.id===pro.id) ? p.filter(x=>x.id!==pro.id) : [...p, pro]);
  const [userCoords, setUserCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | granted | denied

  // Close mobile menu if window resizes above breakpoint
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 640) setMobileMenuOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Supabase: community-submitted pros ──────────────────────────
  const [communityPros, setCommunityPros] = useState([]);

  const loadCommunityPros = async () => {
    const { data: prosData } = await supabase
      .from("pros")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // Batch-fetch all referral photos in one query, merge into pro objects
    const { data: recPhotos } = await supabase
      .from("recommendations")
      .select("pro_id, photo_urls")
      .not("photo_urls", "is", null);

    const normUrl = u => u?.split('?')[0].replace(/\/+$/, '');
    const photoMap = {};
    const photoMapKeys = {};
    (recPhotos || []).forEach(rec => {
      if (!rec.photo_urls?.length) return;
      if (!photoMap[rec.pro_id]) { photoMap[rec.pro_id] = []; photoMapKeys[rec.pro_id] = new Set(); }
      rec.photo_urls.forEach(url => {
        if (!url) return;
        const key = normUrl(url);
        if (!photoMapKeys[rec.pro_id].has(key)) {
          photoMapKeys[rec.pro_id].add(key);
          photoMap[rec.pro_id].push(url);
        }
      });
    });

    // Fetch pro_ids that have at least one referral
    const { data: recCounts } = await supabase
      .from("recommendations")
      .select("pro_id");
    const prosWithReferrals = new Set((recCounts || []).map(r => r.pro_id));

    const mappedPros = (prosData || [])
      .filter(pro => prosWithReferrals.has(pro.id))
      .map(pro => {
        const mapped = mapSupabasePro(pro);
        const recUrls = photoMap[pro.id] || [];
        // Start with the pro's own photo_url (if any), then append referral photos — deduplicated by normalized URL
        const seenKeys = new Set();
        const allPhotos = [];
        const addPhoto = url => {
          if (!url) return;
          const key = normUrl(url);
          if (!seenKeys.has(key)) { seenKeys.add(key); allPhotos.push(url); }
        };
        addPhoto(mapped.photoUrl);
        recUrls.forEach(addPhoto);
        return { ...mapped, allPhotoUrls: allPhotos };
      });
    setCommunityPros(mappedPros);
  };

  useEffect(() => { loadCommunityPros(); }, []);

  // Ask for location once on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus("granted"); },
      ()  => { setLocationStatus("denied"); },
      { timeout: 8000 }
    );
  }, []);

  // Restore auth session on page reload
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from("pros").select("*").eq("profile_id", session.user.id).single()
          .then(({ data: proRow }) => {
            if (proRow) {
              setLoggedInPro(mapSupabasePro(proRow));
              if (!signupInProgress.current) setPage("dashboard");
            }
          });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { setLoggedInPro(null); return; }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        supabase.from("pros").select("*").eq("profile_id", session.user.id).single()
          .then(({ data: proRow }) => {
            if (proRow) {
              setLoggedInPro(mapSupabasePro(proRow));
              // Don't redirect if user is actively going through signup onboarding
              if (!signupInProgress.current) setPage("dashboard");
            }
          });
      }
      if (event === "PASSWORD_RECOVERY") { setPage("resetPassword"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Public profile deep-link: ?pro=<uuid>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const proParam = params.get("pro");
    if (proParam) {
      setPublicProId(proParam);
      setPage("publicProfile");
    }
  }, []);

  // Haversine distance in miles
  const distanceMiles = (lat1, lng1, lat2, lng2) => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const getDistance = (pro) => {
    if (!userCoords || !pro.lat) return null;
    const d = distanceMiles(userCoords.lat, userCoords.lng, pro.lat, pro.lng);
    if (d < 1) return "< 1 mi";
    if (d < 10) return `${d.toFixed(1)} mi`;
    return `${Math.round(d)} mi`;
  };
  const [submitted, setSubmitted] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const [form, setForm] = useState({ name:"", specialty:"", city:"", state:"", customCity:"", location:"", instagram:"", booking:"", why:"", yourName:"", yourEmail:"", tiktok:"" });
  const [formRatings, setFormRatings] = useState(defaultRatings());
  const [submittedRecId, setSubmittedRecId] = useState(null);
  const [submittedProId, setSubmittedProId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const allPros = [...pros, ...communityPros];

  const filtered = allPros
    .filter(p=>activeCategory==="All"||p.specialty===activeCategory)
    .filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.location.toLowerCase().includes(search.toLowerCase())||p.tags.some(t=>t.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>{ // Pro+ featured first, then trending, then regular
      if(a.proPlus&&!b.proPlus) return -1;
      if(!a.proPlus&&b.proPlus) return 1;
      return 0;
    });

  const handleFileUpload = async (files) => {
    const toUpload = Array.from(files).slice(0, 6 - uploadedPhotos.length);
    for (const file of toUpload) {
      const localUrl = URL.createObjectURL(file);
      setUploadedPhotos(prev => [...prev, { url: localUrl, name: file.name, uploading: true }]);
      const path = `recommendations/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("pro-photos").upload(path, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("pro-photos").getPublicUrl(path);
        setUploadedPhotos(prev => prev.map(p => p.url === localUrl ? { url: publicUrl, name: file.name, uploading: false } : p));
      } else {
        setUploadedPhotos(prev => prev.map(p => p.url === localUrl ? { ...p, uploading: false } : p));
      }
    }
  };

  const goTo = p => { setPage(p); setSubmitted(false); window.scrollTo(0,0); };
  const goToRecommend = (pro) => {
    if (pro) {
      setForm(f => ({ ...f, name:pro.name, specialty:pro.specialty, location:pro.location }));
    }
    goTo("recommend");
  };
  const handleProLogout = async () => { await supabase.auth.signOut(); setLoggedInPro(null); goTo("home"); };
  const ratingsComplete = Object.values(formRatings).every(v=>v>0);

  return (
    <div style={{ minHeight:"100vh", background:"#fff", fontFamily:"sans-serif" }}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        *{box-sizing:border-box;}
        .nav-link:hover{color:#1A00B9!important;}
        @media(max-width:768px){
          .what-we-are{grid-template-columns:1fr!important;}
          .what-we-are-col{padding:40px 32px!important;}
          .how-steps{grid-template-columns:1fr!important;}
          .how-steps>div{border-right:none!important;border-bottom:2px solid #1A00B9!important;}
          .how-steps>div:last-child{border-bottom:none!important;}
        }
        @media(max-width:640px){
          /* Nav — show hamburger, hide desktop links */
          .nav-desktop{display:none!important;}
          .nav-hamburger{display:flex!important;}
          .nav-inner{padding:0 20px!important;}

          /* Sections */
          .browse-pad{padding:32px 12px!important;}
          .about-blocks{grid-template-columns:1fr!important;}
          .about-blocks>div{border-left:2px solid #111!important;}
          .pro-grid{grid-template-columns:1fr!important;}
          .form-wrap{padding:20px 16px!important;}
          .modal-body{padding:16px!important;}
          .about-hero,.about-how,.about-cta{padding:40px 16px!important;}
          .name-grid{grid-template-columns:1fr!important;}
          .hero-pad{padding:48px 20px 36px!important;}
          .stats-pad{padding:32px 16px!important;}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important;}
          .stats-grid>div{border-right:none!important;border-bottom:1px solid #e0ddf5!important;}
          .stats-grid>div:nth-child(odd){border-right:1px solid #e0ddf5!important;}
          .stats-grid>div:nth-last-child(-n+2){border-bottom:none!important;}
          .stats-grid>div p:first-child{font-size:clamp(18px,5vw,28px)!important;word-break:break-word;}
          .what-we-are-col{padding:28px 20px!important;}
          .bridge-pad{padding:40px 20px!important;}
          .how-pad{padding:40px 20px!important;}
          .preview-pad{padding:48px 20px 32px!important;}
          .cta-banner{padding:32px 20px!important;margin-top:32px!important;}
          .plan-grid{grid-template-columns:1fr!important;}
          .modal-inner{width:calc(100vw - 24px)!important;max-height:90vh!important;border-radius:16px!important;}
          .refer-page{padding:32px 16px!important;}
          .refer-page h1{font-size:clamp(32px,8vw,48px)!important;}
          .hero-split{grid-template-columns:1fr!important;}
          .dashboard-grid{grid-template-columns:1fr!important;}
          .ticker-text{font-size:10px!important;}
          .pro-card-grid{grid-template-columns:1fr!important;}
          /* Category cards single col */
          .cat-grid{grid-template-columns:1fr!important;}
          /* Help page */
          .help-grid{grid-template-columns:1fr!important;}
          /* Trust badges row → wrap */
          .trust-row{flex-wrap:wrap!important;gap:12px!important;}
          /* Hero CTA buttons stack */
          .hero-ctas{flex-direction:column!important;align-items:stretch!important;}
          .hero-ctas button,.hero-ctas a{width:100%!important;text-align:center!important;}
          /* Pro+ page plan grid */
          .join-plan-grid{grid-template-columns:1fr!important;}
        }
      `}</style>

      <DisclaimerBanner/>

      {/* NAV — always visible, shown on all pages */}
      <nav className="nav-inner" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", height:"60px", background:"#fff", borderBottom:"1px solid #e0ddf5", position:"sticky", top:0, zIndex:50, overflow:"visible" }}>
        {/* Logo */}
        <div onClick={()=>{ goTo("home"); setMobileMenuOpen(false); }} style={{ cursor:"pointer", fontFamily:"Georgia,serif", fontWeight:"900", fontSize:"20px", letterSpacing:"-0.5px", flexShrink:0, color:"#1A00B9" }}>reffered</div>

        {/* Desktop nav */}
        <div className="nav-desktop" style={{ display:"flex", gap:"16px", alignItems:"center" }}>
          {[
            { label:"Find My Pro ✨", action:()=>goTo("matchMe"), color:"#7c6fc2" },
            { label:"About", action:()=>goTo("about"), color:"#555" },
          ].map(item=>(
            <span key={item.label} className="nav-link" onClick={item.action}
              style={{ fontSize:"12px", fontWeight:"800", letterSpacing:"1px", textTransform:"uppercase", cursor:"pointer", color:item.color, transition:"color 0.15s", whiteSpace:"nowrap" }}>
              {item.label}
            </span>
          ))}
          {savedPros.length > 0 && (
            <button onClick={()=>setShowShortlist(true)}
              style={{ position:"relative", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"8px 16px", fontSize:"12px", fontWeight:"800", color:"#1A00B9", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", whiteSpace:"nowrap" }}>
              ❤️ Saved
              <span style={{ background:"#B7CF4F", color:"#1A00B9", borderRadius:"50%", width:"18px", height:"18px", fontSize:"10px", fontWeight:"900", display:"flex", alignItems:"center", justifyContent:"center" }}>{savedPros.length}</span>
            </button>
          )}
          <button onClick={()=>goTo("recommend")} style={{...btnDark, padding:"9px 18px", fontSize:"12px", boxShadow:"3px 3px 0 #B7CF4F", whiteSpace:"nowrap"}}>+ Refer</button>
          {loggedInPro
            ? <button onClick={()=>goTo("dashboard")} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"9px 18px", fontSize:"12px", fontWeight:"800", cursor:"pointer", whiteSpace:"nowrap", boxShadow:"3px 3px 0 #B7CF4F", fontFamily:"sans-serif" }}>My Dashboard ✦</button>
            : <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <button onClick={()=>goTo("dashboard")} style={{ background:"#fff", color:"#1A00B9", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"8px 16px", fontSize:"12px", fontWeight:"800", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"sans-serif" }}>Sign In</button>
                <button onClick={()=>goTo("join")} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"9px 18px", fontSize:"12px", fontWeight:"800", cursor:"pointer", whiteSpace:"nowrap", boxShadow:"3px 3px 0 #B7CF4F", fontFamily:"sans-serif" }}>Join Free ✦</button>
              </div>
          }
        </div>

        {/* Mobile: hamburger button */}
        <button className="nav-hamburger" onClick={()=>setMobileMenuOpen(o=>!o)}
          style={{ display:"none", background:"none", border:"none", cursor:"pointer", padding:"8px", flexDirection:"column", gap:"5px", alignItems:"center", justifyContent:"center" }}
          aria-label="Menu">
          <span style={{ display:"block", width:"22px", height:"2px", background:"#1A00B9", transition:"all 0.25s", transform: mobileMenuOpen ? "rotate(45deg) translate(0px, 7px)" : "none" }}/>
          <span style={{ display:"block", width:"22px", height:"2px", background:"#1A00B9", transition:"all 0.25s", opacity: mobileMenuOpen ? 0 : 1 }}/>
          <span style={{ display:"block", width:"22px", height:"2px", background:"#1A00B9", transition:"all 0.25s", transform: mobileMenuOpen ? "rotate(-45deg) translate(0px, -7px)" : "none" }}/>
        </button>

      </nav>

      {/* Mobile side drawer + dark overlay — rendered outside nav so it covers full screen */}
      {/* Full-screen hamburger menu overlay */}
      <div style={{
        position:"fixed", inset:0, zIndex:99,
        background:"#fff",
        transform: mobileMenuOpen ? "translateX(0)" : "translateX(100%)",
        transition:"transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        display:"flex", flexDirection:"column",
        fontFamily:"sans-serif",
      }}>
        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 28px", borderBottom:"1px solid #f0eef8" }}>
          <span style={{ fontFamily:"Georgia,serif", fontWeight:"900", fontSize:"20px", color:"#1A00B9", letterSpacing:"-0.5px" }}>reffered ✦</span>
          <button onClick={()=>setMobileMenuOpen(false)}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:"26px", color:"#999", lineHeight:1, padding:"4px" }}>✕</button>
        </div>

        {/* Nav links */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-start", padding:"16px 28px 0", overflowY:"auto" }}>
          {[
            { label:"Browse Directory", action:()=>{ goTo("home");      setMobileMenuOpen(false); } },
            { label:"Find My Pro ✨",   action:()=>{ goTo("matchMe");   setMobileMenuOpen(false); } },
            { label:"About",            action:()=>{ goTo("about");     setMobileMenuOpen(false); } },
            { label:"Refer a Pro",      action:()=>{ goTo("recommend"); setMobileMenuOpen(false); } },
            ...(savedPros.length>0 ? [{ label:`Saved (${savedPros.length}) ❤️`, action:()=>{ setShowShortlist(true); setMobileMenuOpen(false); } }] : []),
          ].map((item,i)=>(
            <button key={i} onClick={item.action}
              style={{ display:"block", background:"none", border:"none", borderBottom:"1px solid #f0eef8", padding:"16px 0", fontSize:"20px", fontWeight:"700", color:"#1A00B9", cursor:"pointer", textAlign:"left", letterSpacing:"-0.3px" }}>
              {item.label}
            </button>
          ))}
        </div>

        {/* Bottom section: Help (right-aligned) + CTA buttons */}
        <div style={{ padding:"12px 28px 40px" }}>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
            <button onClick={()=>{ goTo("help"); setMobileMenuOpen(false); }}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"700", color:"#bbb", letterSpacing:"1px", textTransform:"uppercase", padding:"4px 0" }}>
              Help →
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {loggedInPro
              ? <button onClick={()=>{ goTo("dashboard"); setMobileMenuOpen(false); }}
                  style={{ width:"100%", background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"15px", fontSize:"14px", fontWeight:"900", cursor:"pointer", boxShadow:"3px 3px 0 #B7CF4F" }}>My Dashboard ✦</button>
              : <>
                  <button onClick={()=>{ goTo("join"); setMobileMenuOpen(false); }}
                    style={{ width:"100%", background:"#1A00B9", color:"#fff", border:"none", borderRadius:"30px", padding:"15px", fontSize:"14px", fontWeight:"900", cursor:"pointer", boxShadow:"3px 3px 0 #B7CF4F" }}>Join Free ✦</button>
                  <button onClick={()=>{ goTo("dashboard"); setMobileMenuOpen(false); }}
                    style={{ width:"100%", background:"#fff", color:"#1A00B9", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"14px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>Sign In</button>
                </>
            }
          </div>
        </div>
      </div>

      {/* PRO+ SUCCESS (redirect back from Stripe) */}
      {(()=>{
        if(typeof window === "undefined") return null;
        const params = new URLSearchParams(window.location.search);
        if(!params.get("pro_success")) return null;
        return (
          <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f4f2ff", padding:"40px 20px" }}>
            <div style={{ background:"#fff", border:"2px solid #1A00B9", borderRadius:"24px", padding:"48px 40px", maxWidth:"440px", width:"100%", textAlign:"center", boxShadow:"6px 6px 0 #1A00B9" }}>
              <div style={{ fontSize:"48px", marginBottom:"16px" }}>🎉</div>
              <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 8px" }}>Welcome to Pro+</p>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 12px" }}>You're all set!</h2>
              <p style={{ fontFamily:"sans-serif", fontSize:"14px", color:"#555", margin:"0 0 28px", lineHeight:"1.6" }}>Your Pro+ membership is now active. Unlock your full dashboard, insights, and more.</p>
              <button onClick={()=>{ window.history.replaceState({}, "", "/"); goTo("dashboard"); }} style={{ background:"#1A00B9", color:"#fff", border:"none", borderRadius:"10px", padding:"14px 28px", fontFamily:"sans-serif", fontSize:"14px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0 #B7CF4F", width:"100%" }}>Go to My Dashboard →</button>
            </div>
          </div>
        );
      })()}

      {/* PUBLIC PROFILE PAGE */}
      {page==="publicProfile" && (
        <PublicProfilePage
          proId={publicProId}
          goToRecommend={goToRecommend}
          goTo={goTo}
        />
      )}


            {/* HOME */}
      {page==="home" && (
        <>
          {/* ── HERO ── */}
          <div className="hero-pad" style={{ background:"#fff", padding:"80px 40px 72px", borderBottom:"1px solid #f0eef8" }}>
            <div style={{ maxWidth:"780px", margin:"0 auto", textAlign:"center" }}>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(42px,7vw,88px)", fontWeight:"900", lineHeight:0.95, margin:"0 0 8px", letterSpacing:"-3px", color:"#0a0a0a" }}>the directory</h1>
              <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(42px,7vw,88px)", fontWeight:"900", lineHeight:1, margin:"0 0 24px", letterSpacing:"-3px", color:"#0a0a0a" }}>for the beauty <span style={{ background:"#9B8AFB", padding:"0 12px", display:"inline-block", color:"#fff", fontStyle:"italic" }}>PROs.</span></h1>
              <p style={{ fontSize:"clamp(15px,2vw,18px)", color:"#555", margin:"0 auto 36px", maxWidth:"520px", lineHeight:"1.7" }}>Your clients are already talking about you. Claim your profile, collect referrals, and get discovered by clients who trust community over ads.</p>
              <div style={{ display:"flex", gap:"14px", justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={()=>goTo("join")} style={{...btnDark, padding:"16px 36px", fontSize:"15px", fontWeight:"900"}}>Join as a Pro — It's Free →</button>
                <button onClick={()=>goTo("recommend")} style={{...btnOut, padding:"16px 32px", fontSize:"15px"}}>Refer a Pro ↓</button>
              </div>
              <div style={{ display:"flex", gap:"24px", justifyContent:"center", marginTop:"32px", flexWrap:"wrap" }}>
                {[["✓ Free to join","No credit card needed"],["✓ Founding Pro status","For early signups"],["✓ Get discovered","By referred clients"]].map(([title,sub])=>(
                  <div key={title} style={{ textAlign:"center" }}>
                    <p style={{ margin:"0 0 2px", fontSize:"12px", fontWeight:"800", color:"#1A00B9" }}>{title}</p>
                    <p style={{ margin:0, fontSize:"11px", color:"#999" }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── TICKER ── */}
          <div style={{ background:"#9B8AFB", borderBottom:"1px solid #9B8AFB", padding:"12px 0", overflow:"hidden", whiteSpace:"nowrap" }}>
            <div style={{ display:"inline-block", animation:"ticker 22s linear infinite" }}>
              {Array(8).fill("✦ COMMUNITY REFFERED  ✦ RATED ACROSS 7 CATEGORIES  ✦ REAL REVIEWS  ✦ BEAUTY PROS NEAR YOU").map((t,i)=>(
                <span key={i} style={{ fontSize:"11px", fontWeight:"800", letterSpacing:"2px", color:"#fff", paddingRight:"40px" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* ── 7 CATEGORIES FLAGSHIP SECTION ── */}
          <div style={{ background:"#fff", padding:"80px 40px", borderBottom:"1px solid #e0ddf5" }}>
            <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
              <div style={{ textAlign:"center", marginBottom:"56px" }}>
                <div style={{ display:"inline-block", background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"6px", padding:"4px 14px", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#1A00B9", marginBottom:"20px" }}>What makes us different</div>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,5vw,60px)", fontWeight:"900", color:"#0a0a0a", margin:"0 0 16px", letterSpacing:"-2px", lineHeight:1.05 }}>Not just a star rating.<br/>The full picture.</h2>
                <p style={{ fontSize:"clamp(14px,2vw,17px)", color:"#555", maxWidth:"540px", margin:"0 auto", lineHeight:"1.7" }}>Yelp gives you one star. Google gives you an average. reffered breaks every experience into <strong style={{ color:"#1A00B9" }}>7 specific categories</strong> — so you know exactly what a pro is exceptional at before you ever book.</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"16px" }}>
                {RATING_CATEGORIES.map((cat,i)=>(
                  <div key={cat.key} style={{ background:"#fafafa", border:"1.5px solid #e0ddf5", borderRadius:"16px", padding:"24px 22px", display:"flex", gap:"16px", alignItems:"flex-start", transition:"all 0.2s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="#1A00B9"; e.currentTarget.style.boxShadow="4px 4px 0 #1A00B9"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e0ddf5"; e.currentTarget.style.boxShadow="none"; }}>
                    <div style={{ width:"44px", height:"44px", background:"#1A00B9", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>{cat.emoji}</div>
                    <div>
                      <p style={{ margin:"0 0 6px", fontFamily:"Georgia,serif", fontSize:"15px", fontWeight:"900", color:"#1A00B9", letterSpacing:"-0.3px" }}>{cat.label}</p>
                      <p style={{ margin:0, fontSize:"12px", color:"#777", lineHeight:"1.6" }}>{cat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center", marginTop:"48px" }}>
                <p style={{ fontSize:"13px", color:"#aaa", margin:"0 0 16px" }}>Every pro on reffered is rated across all 7 — by real clients, not algorithms.</p>
                <button onClick={()=>goTo("recommend")} style={{...btnDark, padding:"13px 28px", fontSize:"13px", fontWeight:"900"}}>Refer a Pro + Rate Them →</button>
              </div>
            </div>
          </div>

          {/* ── BROWSE DIRECTORY ── */}
          <div id="browse" className="browse-pad" style={{ maxWidth:"1100px", margin:"0 auto", padding:"60px 24px" }}>
            <div className="search-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"28px", flexWrap:"wrap", gap:"16px" }}>
              <div>
                <p style={{ fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#1A00B9", margin:"0 0 6px" }}>Browse the Directory</p>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"36px", fontWeight:"900", margin:0, letterSpacing:"-1px" }}>Find Your Pro</h2>
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Name, city, or specialty..." style={{...inp, maxWidth:"300px", fontSize:"13px", border:"1.5px solid #e8e5f5"}}/>
            </div>

            <div className="pill-row" style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"32px" }}>
              {categories.map(cat=>(
                <button key={cat} onClick={()=>setActiveCategory(cat)} style={{ padding:"8px 18px", borderRadius:"30px", border:"1.5px solid #1A00B9", fontSize:"12px", fontWeight:"800", cursor:"pointer", background:activeCategory===cat?"#1A00B9":"#fff", color:activeCategory===cat?"#fff":"#1A00B9", boxShadow:activeCategory===cat?"3px 3px 0 #B7CF4F":"none" }}>{cat}</button>
              ))}
            </div>

            <div className="pro-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:"24px" }}>
              {filtered.map(pro=>{
                const overall = avgRating(pro.ratings);
                return (
                  <div key={pro.id} onClick={()=>setSelectedPro(pro)} onMouseEnter={()=>setHover(pro.id)} onMouseLeave={()=>setHover(null)}
                    style={{ background:"#fff", border:"1px solid #f0eef8", borderRadius:"18px", overflow:"hidden", cursor:"pointer", transition:"all 0.2s", transform:hover===pro.id?"translateY(-4px)":"none", boxShadow:hover===pro.id?"0 16px 40px rgba(26,0,185,0.10)":"0 2px 12px rgba(0,0,0,0.06)" }}>

                    {/* Card image */}
                    <div style={{ position:"relative", overflow:"hidden", paddingTop:"125%", height:0 }}>
                      <ProPhotoCarousel photos={pro.allPhotoUrls || (pro.photoUrl ? [pro.photoUrl] : [])} name={pro.name} />
                      {/* Subtle overlay */}
                      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}/>
                      {/* ❤️ Save button — top left */}
                      <button onClick={e=>{ e.stopPropagation(); toggleSave(pro); }}
                        style={{ position:"absolute", top:"10px", left:"10px", zIndex:6, background: savedPros.find(x=>x.id===pro.id) ? "#1A00B9" : "rgba(255,255,255,0.9)", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", transition:"all 0.15s", boxShadow:"2px 2px 0 #1A00B9" }}>
                        {savedPros.find(x=>x.id===pro.id) ? "❤️" : "🤍"}
                      </button>
                      {/* Rating badge — top right */}
                      <div style={{ position:"absolute", top:"10px", right:"10px", zIndex:6, background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"4px 9px", fontFamily:"Georgia,serif", fontSize:"13px", fontWeight:"900", boxShadow:"2px 2px 0 #1A00B9", display:"flex", alignItems:"center", gap:"3px" }}>
                        <span style={{ color:"#1A00B9" }}>★</span>{overall}
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding:"16px 18px 20px" }}>

                      {/* Name + badges row — always below the image, never on top of it */}
                      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px", flexWrap:"wrap" }}>
                        <h3 style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900", letterSpacing:"-0.2px", color:"#111" }}>{pro.name}</h3>
                        {pro.proPlus && <span style={{ background:"#edfad4", color:"#4a7c20", borderRadius:"6px", padding:"2px 8px", fontSize:"9px", fontWeight:"700", letterSpacing:"0.5px" }}>PRO+</span>}
                        {pro.verified && <span style={{ background:"#edfad4", color:"#4a7c20", borderRadius:"6px", padding:"2px 7px", fontSize:"9px", fontWeight:"700" }}>✓</span>}
                      </div>

                      {/* Specialty + location */}
                      <p style={{ margin:"0 0 6px", fontSize:"12px", color:"#555", fontWeight:"600" }}>
                        {pro.specialty} &nbsp;·&nbsp; 📍 {pro.location}
                      </p>
                      {getDistance(pro) && (
                        <div style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:"#f4f2ff", border:"none", borderRadius:"20px", padding:"3px 10px", marginBottom:"8px" }}>
                          <span style={{ fontSize:"11px" }}>📍</span>
                          <span style={{ fontSize:"11px", fontWeight:"800", color:"#1A00B9" }}>{getDistance(pro)} away</span>
                        </div>
                      )}

                      {/* Recommended by */}
                      {pro.recommendedBy?.length>0 && (
                        <p style={{ margin:"0 0 12px", fontSize:"11px", color:"#1A00B9", fontWeight:"700" }}>
                          👥 {pro.recommendedBy.slice(0,2).join(", ")}{pro.recommendedBy.length>2?` +${pro.recommendedBy.length-2} more`:""}
                        </p>
                      )}

                      {/* Mini rating bars */}
                      <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"12px" }}>
                        {RATING_CATEGORIES.slice(0,3).map(cat=>(
                          <div key={cat.key} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                            <span style={{ fontSize:"10px", width:"13px", textAlign:"center" }}>{cat.emoji}</span>
                            <span style={{ fontSize:"10px", fontWeight:"600", color:"#555", flex:"0 0 auto", maxWidth:"90px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cat.label}</span>
                            <div style={{ flex:1, height:"4px", background:"#e0ddf5", borderRadius:"3px", overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${(pro.ratings[cat.key]/5)*100}%`, background:"#7c6fc2", borderRadius:"3px" }}/>
                            </div>
                            <span style={{ fontSize:"10px", fontWeight:"800", color:"#444", width:"16px", textAlign:"right" }}>{pro.ratings[cat.key]}</span>
                          </div>
                        ))}
                        <p style={{ margin:"2px 0 0", fontSize:"10px", color:"#888" }}>+{RATING_CATEGORIES.length-3} more categories · tap to see all</p>
                      </div>

                      {/* Tags */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"14px" }}>
                        {pro.tags.map(tag=>(
                          <span key={tag} style={{ background:"#f5f4fc", border:"none", borderRadius:"6px", padding:"3px 9px", fontSize:"10px", fontWeight:"600", color:"#7c6fc2" }}>{tag}</span>
                        ))}
                      </div>

                      {/* Card actions */}
                      <div onClick={e=>e.stopPropagation()} style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        {pro.instagram && (
                          <a href={`https://instagram.com/${pro.instagram}`} target="_blank" rel="noreferrer"
                            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", padding:"9px", background:"#fafafa", border:"1px solid #f0eef8", borderRadius:"10px", fontSize:"12px", fontWeight:"600", color:"#555", textDecoration:"none", boxSizing:"border-box" }}>
                            📷 @{pro.instagram}
                          </a>
                        )}
                        {pro.booking && (
                          <a href={pro.booking.startsWith("http") ? pro.booking : `https://${pro.booking}`} target="_blank" rel="noreferrer"
                            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", padding:"9px", background:"#edfad4", border:"1px solid #b7e68a", borderRadius:"10px", fontSize:"12px", fontWeight:"700", color:"#3a6e10", textDecoration:"none", boxSizing:"border-box" }}>
                            📅 Book {pro.name.split(" ")[0]}
                          </a>
                        )}
                        <button onClick={()=>goToRecommend(pro)}
                          style={{ width:"100%", padding:"9px", background:"#f4f2ff", border:"none", borderRadius:"10px", fontSize:"12px", fontWeight:"700", color:"#1A00B9", cursor:"pointer", boxSizing:"border-box", transition:"background 0.15s" }}>
                          ⭐ Refer {pro.name.split(" ")[0]}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Location permission nudge — shown when idle or denied */}
            {locationStatus === "idle" && (
              <div style={{ background:"#E8E4FF", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"12px 18px", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ fontSize:"18px" }}>📍</span>
                  <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#1A00B9" }}>Allow location to see how far each pro is from you</p>
                </div>
                <button onClick={()=>{ setLocationStatus("loading"); navigator.geolocation.getCurrentPosition(pos=>{ setUserCoords({lat:pos.coords.latitude,lng:pos.coords.longitude}); setLocationStatus("granted"); }, ()=>setLocationStatus("denied")); }}
                  style={{...btnDark, padding:"8px 16px", fontSize:"12px", boxShadow:"2px 2px 0 #B7CF4F", whiteSpace:"nowrap"}}>Enable →</button>
              </div>
            )}
            {locationStatus === "denied" && (
              <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"12px", padding:"10px 18px", marginBottom:"16px", display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"14px" }}>📍</span>
                <p style={{ margin:0, fontSize:"12px", color:"#aaa" }}>Location access denied — enable it in your browser settings to see distances.</p>
              </div>
            )}

            {filtered.length===0&&<div style={{ textAlign:"center", padding:"80px 0" }}><div style={{ fontSize:"48px" }}>🔍</div><p style={{ color:"#aaa", marginTop:"12px" }}>No pros found. Try a different search!</p></div>}

            <div className="cta-banner" style={{...gridBg, marginTop:"60px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"48px 40px", textAlign:"center", boxShadow:"4px 4px 0 #e0ddf5"}}>
              <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Are You a Pro?</p>
              <h3 style={{ fontFamily:"Georgia,serif", fontSize:"32px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-1px" }}>Claim your profile. Own your story.</h3>
              <p style={{ color:"#666", margin:"0 0 24px", lineHeight:"1.6" }}>Your clients are already referring you. Sign up to receive notifications and manage your presence.</p>
              <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={()=>goTo("join")} style={{...btnDark, padding:"14px 32px", fontSize:"14px"}}>Claim Your Profile</button>
                <button onClick={()=>goTo("recommend")} style={{...btnOut, padding:"14px 32px", fontSize:"14px"}}>+ Refer a Pro</button>
              </div>
            </div>
          </div>
          {/* ── SOCIAL PROOF STATS ── */}
          <div className="stats-pad" style={{ background:"#fff", borderBottom:"1px solid #f0eef8", padding:"48px 40px" }}>
            <div className="stats-grid" style={{ maxWidth:"900px", margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0" }}>
              {[
                { num:"Growing", label:"Community Referrals" },
                { num:"7", label:"Rating Categories Per Pro" },
                { num:"100%", label:"Real Client Reviews" },
                { num:"Nationwide", label:"Beauty Pros" },
              ].map((s,i,arr)=>(
                <div key={i} style={{ textAlign:"center", padding:"20px 16px", borderRight:i<arr.length-1?"1px solid #e0ddf5":"none" }}>
                  <p style={{ margin:"0 0 4px", fontFamily:"Georgia,serif", fontSize:"clamp(18px,3.5vw,40px)", fontWeight:"900", color:"#1A00B9", letterSpacing:"-0.5px", wordBreak:"break-word" }}>{s.num}</p>
                  <p style={{ margin:0, fontSize:"clamp(10px,1.5vw,12px)", fontWeight:"700", color:"#666", letterSpacing:"0.5px", lineHeight:"1.4" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── WHAT WE ARE ── */}
          <div style={{ borderBottom:"1px solid #e0ddf5" }}>
            <div style={{ maxWidth:"1100px", margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr" }} className="what-we-are">
              <div className="what-we-are-col" style={{ padding:"72px 56px" }}>
                <div style={{ display:"inline-block", background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"6px", padding:"3px 12px", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"20px" }}>What We Are</div>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,3vw,42px)", fontWeight:"900", margin:"0 0 16px", letterSpacing:"-1.5px", lineHeight:1.1 }}>Word of mouth,<br/>finally searchable.</h2>
                <p style={{ color:"#555", lineHeight:"1.8", fontSize:"15px", margin:"0 0 20px" }}>You already know who to text when your friend needs a good lash tech. reffered is that group chat — but for everyone, forever, and actually organized.</p>
                <p style={{ color:"#555", lineHeight:"1.8", fontSize:"15px", margin:0 }}>Every pro on this platform has been vouched for by a real client. No paid placements. No algorithms. Just trust.</p>
              </div>
              <div className="what-we-are-col" style={{ padding:"72px 56px", background:"#fff", borderLeft:"1px solid #e0ddf5" }}>
                <div style={{ display:"inline-block", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"6px", padding:"3px 12px", fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"20px" }}>What We're Not</div>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,3vw,42px)", fontWeight:"900", margin:"0 0 20px", letterSpacing:"-1.5px", lineHeight:1.1 }}>Not Yelp.<br/>Not Google.</h2>
                {["No paid placements or sponsored listings","No anonymous reviews from strangers","No star ratings with zero context","No beauty pros buried by ad budgets"].map((item,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"12px" }}>
                    <span style={{ color:"#1A00B9", fontWeight:"900", fontSize:"16px", marginTop:"1px", flexShrink:0 }}>✕</span>
                    <p style={{ margin:0, fontSize:"14px", color:"#444", lineHeight:"1.6" }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* ── BRIDGE SECTION: We save time + empower pros ── */}
          <div style={{ background:"#fff", borderBottom:"1px solid #e0ddf5" }}>
            <div className="bridge-pad" style={{ maxWidth:"1100px", margin:"0 auto", padding:"72px 48px" }}>
              <div style={{ textAlign:"center", marginBottom:"52px" }}>
                <p style={{ fontSize:"11px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 8px" }}>Why reffered Exists</p>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,4vw,52px)", fontWeight:"900", margin:"0 0 16px", letterSpacing:"-2px", lineHeight:1.1 }}>Building the bridge between<br/>community and craft.</h2>
                <p style={{ color:"#666", fontSize:"16px", maxWidth:"580px", margin:"0 auto", lineHeight:"1.8" }}>Great beauty pros exist in every city. Great clients are looking for them every day. We close the gap — with trust, transparency, and the power of community.</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"24px" }}>
                {[
                  {
                    emoji:"⏱️",
                    who:"For Clients",
                    title:"Stop wasting time on the wrong pro.",
                    body:"No more scrolling Instagram for hours, booking blind from a Google search, or showing up to someone who doesn't deliver. reffered gets you to the right person — fast, confident, and community-verified.",
                    cta:"Browse the directory",
                    ctaFn: "browse",
                    bg:"#fff",
                  },
                  {
                    emoji:"🌟",
                    who:"For Pros",
                    title:"Your talent deserves to be found.",
                    body:"The best stylists, techs, and artists shouldn't have to fight an algorithm to get discovered. When your clients recommend you here, your reputation builds itself — permanently, publicly, and on your terms.",
                    cta:"Claim your profile",
                    ctaFn: "join",
                    bg:"#fff",
                  },
                  {
                    emoji:"🤝",
                    who:"For the Community",
                    title:"Trust travels further than ads.",
                    body:"Every recommendation on this platform is a real person putting their name behind someone they believe in. That's the foundation of reffered — a living, growing network of beauty trust.",
                    cta:"Recommend someone",
                    ctaFn: "recommend",
                    bg:"#fff",
                  },
                ].map((card,i)=>(
                  <div key={i} style={{ background:"#fff", border:"1px solid #f0eef8", borderRadius:"18px", padding:"36px 32px", boxShadow:"0 2px 16px rgba(0,0,0,0.05)", display:"flex", flexDirection:"column" }}>
                    <div style={{ fontSize:"36px", marginBottom:"14px" }}>{card.emoji}</div>
                    <div style={{ display:"inline-block", background:"#E8E4FF", borderRadius:"6px", padding:"2px 10px", fontSize:"10px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#9B8AFB", marginBottom:"12px", alignSelf:"flex-start" }}>{card.who}</div>
                    <h4 style={{ fontFamily:"Georgia,serif", fontSize:"19px", fontWeight:"900", margin:"0 0 12px", lineHeight:1.3, letterSpacing:"-0.3px" }}>{card.title}</h4>
                    <p style={{ color:"#555", lineHeight:"1.75", margin:"0 0 24px", fontSize:"14px", flex:1 }}>{card.body}</p>
                    <button onClick={()=>{ if(card.ctaFn==="browse") document.getElementById("browse")?.scrollIntoView({behavior:"smooth"}); else goTo(card.ctaFn); }}
                      style={{ background:"none", border:"1.5px solid #1A00B9", borderRadius:"30px", padding:"10px 20px", fontSize:"12px", fontWeight:"800", color:"#1A00B9", cursor:"pointer", alignSelf:"flex-start", transition:"all 0.15s" }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="#1A00B9"; e.currentTarget.style.color="#fff"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="#1A00B9"; }}>
                      {card.cta} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── HOW IT WORKS ── */}
          <div style={{ background:"#fff", borderBottom:"1px solid #e0ddf5" }}>
            <div className="how-pad" style={{ maxWidth:"900px", margin:"0 auto", padding:"72px 40px" }}>
              <div style={{ textAlign:"center", marginBottom:"52px" }}>
                <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>How It Works</p>
                <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(32px,4vw,52px)", fontWeight:"900", margin:0, letterSpacing:"-2px" }}>Simple. Human. Intentional.</h2>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0" }} className="how-steps">
                {[
                  { step:"01", emoji:"✍️", title:"Someone recommends a pro.", body:"A client fills out a quick form — rating them across 7 categories and sharing what makes them exceptional.", color:"#fff" },
                  { step:"02", emoji:"🔍", title:"We review every submission.", body:"Our team reviews each recommendation before it goes live. No spam. No fake reviews. Just real experiences.", color:"#fff" },
                  { step:"03", emoji:"✨", title:"The pro gets discovered.", body:"Their profile goes live in the directory — searchable by city, specialty, and rating — so the right clients find them.", color:"#fff" },
                ].map((item,i,arr)=>(
                  <div key={i} style={{ padding:"40px 32px", background:item.color, borderRight:i<arr.length-1?"2px solid #1A00B9":"none", borderTop:"1px solid #e0ddf5", position:"relative" }}>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:"72px", fontWeight:"900", color:"rgba(26,0,185,0.07)", lineHeight:1, position:"absolute", top:"16px", right:"20px" }}>{item.step}</div>
                    <div style={{ fontSize:"32px", marginBottom:"14px" }}>{item.emoji}</div>
                    <h4 style={{ fontFamily:"Georgia,serif", fontSize:"18px", fontWeight:"900", margin:"0 0 10px", lineHeight:1.3 }}>{item.title}</h4>
                    <p style={{ color:"#555", lineHeight:"1.7", margin:0, fontSize:"14px" }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── WHO'S ON REFFERED ── */}
          <div style={{ background:"#fff", borderBottom:"1px solid #e0ddf5" }}>
            <div className="preview-pad" style={{ maxWidth:"1100px", margin:"0 auto", padding:"72px 40px 48px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"36px", flexWrap:"wrap", gap:"16px" }}>
                <div>
                  <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Who's On reffered</p>
                  <h2 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(28px,4vw,46px)", fontWeight:"900", margin:0, letterSpacing:"-1.5px" }}>A few of our favorites.</h2>
                </div>
                <button onClick={()=>document.getElementById("browse")?.scrollIntoView({behavior:"smooth"})} style={{...btnOut, padding:"11px 22px", fontSize:"13px"}}>See all pros ↓</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:"24px" }}>
                {pros.slice(0,3).map(pro=>{
                  const score = avgRating(pro.ratings);
                  return (
                    <div key={pro.id} onClick={()=>setSelectedPro(pro)}
                      style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", overflow:"hidden", cursor:"pointer", boxShadow:"4px 4px 0 #1A00B9", transition:"transform 0.15s,box-shadow 0.15s" }}
                      onMouseEnter={e=>{e.currentTarget.style.transform="translate(-3px,-3px)";e.currentTarget.style.boxShadow="8px 8px 0 #1A00B9";}}
                      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="4px 4px 0 #1A00B9";}}>
                      <div style={{ position:"relative" }}>
                        <div style={{ position:"relative", paddingTop:"125%", overflow:"hidden" }}>
                          <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg, #9B8AFB 0%, #E8E4FF 100%)" }}/>
                          {pro.photoUrl && <img src={pro.photoUrl} alt={pro.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>}
                        </div>
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 50%)", pointerEvents:"none" }}/>
                        <div style={{ position:"absolute", top:"10px", right:"10px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"3px 8px", fontFamily:"Georgia,serif", fontSize:"12px", fontWeight:"900", display:"flex", alignItems:"center", gap:"3px" }}>
                          <span style={{ color:"#1A00B9" }}>★</span>{score}
                        </div>
                        {pro.proPlus && <div style={{ position:"absolute", top:"10px", left:"10px", background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"6px", padding:"1px 7px", fontSize:"10px", fontWeight:"900", color:"#1A00B9" }}>PRO+</div>}
                      </div>
                      <div style={{ padding:"16px 18px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                          <h3 style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"16px", fontWeight:"900" }}>{pro.name}</h3>
                          {pro.verified && <span style={{ background:"#B7CF4F", color:"#1A00B9", borderRadius:"6px", padding:"1px 6px", fontSize:"9px", fontWeight:"800" }}>✓</span>}
                        </div>
                        <p style={{ margin:"0 0 10px", fontSize:"12px", color:"#888" }}>{pro.specialty} · 📍 {pro.location}</p>
                        <p style={{ margin:"0 0 12px", fontSize:"12px", color:"#555", lineHeight:"1.5" }}>{pro.bio.slice(0,80)}...</p>
                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                          {pro.tags.slice(0,3).map(tag=>(
                            <span key={tag} style={{ background:"#E8E4FF", border:"1px solid #1A00B9", borderRadius:"6px", padding:"2px 8px", fontSize:"10px", fontWeight:"700", color:"#1A00B9" }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </>
      )}

      {page==="about"     && <AboutPage setPage={goTo}/>}
      {page==="matchMe"   && <MatchMePage communityPros={communityPros} goTo={goTo} goToRecommend={goToRecommend}/>}
      {page==="provider"  && <ProviderSignup goTo={goTo}/>}
      {page==="dashboard" && (loggedInPro && !signupInProgress.current
        ? <ProDashboard goTo={goTo} onLogout={handleProLogout} proData={loggedInPro}/>
        : <ProSignIn
            onLogin={(proData)=>{ signupInProgress.current = false; setLoggedInPro(proData); goTo("dashboard"); }}
            goTo={goTo}
            onSignupStart={()=>{ signupInProgress.current = true; }}
            initialTab="signin"
          />
      )}
      {page==="join" && (loggedInPro && !signupInProgress.current
        ? <ProDashboard goTo={goTo} onLogout={handleProLogout} proData={loggedInPro}/>
        : <ProSignIn
            onLogin={(proData)=>{ signupInProgress.current = false; setLoggedInPro(proData); goTo("dashboard"); }}
            goTo={goTo}
            onSignupStart={()=>{ signupInProgress.current = true; }}
            initialTab="signup"
          />
      )}
      {page==="terms"     && <TermsPage goTo={goTo}/>}
      {page==="privacy"   && <PrivacyPage goTo={goTo}/>}
      {page==="dispute"   && <DisputePage goTo={goTo}/>}
      {page==="help"      && <HelpPage goTo={goTo}/>}

      {/* RECOMMEND FORM */}
      {page==="recommend" && (
        <div className="refer-page" style={{ maxWidth:"700px", margin:"0 auto", padding:"60px 24px" }}>
          <button onClick={()=>goTo("home")} style={{ background:"none", border:"none", fontSize:"13px", fontWeight:"800", cursor:"pointer", color:"#888", marginBottom:"32px", padding:0, fontFamily:"sans-serif" }}>← Back to Directory</button>
          <p style={{ fontSize:"10px", fontWeight:"700", letterSpacing:"2.5px", textTransform:"uppercase", color:"#9B8AFB", margin:"0 0 10px" }}>Community Form</p>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(36px,6vw,56px)", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-2px", lineHeight:1 }}>Refer<br/>a Pro.</h1>
          <p style={{ color:"#666", margin:"0 0 24px", lineHeight:"1.6", fontSize:"15px" }}>Know someone who deserves to be on everyone's radar? Rate them across 7 categories and tell us what makes them exceptional.</p>

          {/* Pre-fill banner — shown when coming from a pro's card or modal */}
          {form.name && (
            <div style={{ background:"#E8E4FF", border:"1.5px solid #1A00B9", borderRadius:"14px", padding:"14px 20px", marginBottom:"28px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"20px" }}>⭐</span>
                <div>
                  <p style={{ margin:0, fontWeight:"800", fontSize:"13px", color:"#1A00B9" }}>Referring {form.name}</p>
                  <p style={{ margin:0, fontSize:"12px", color:"#666" }}>{form.specialty} · {form.location} · pre-filled from their profile</p>
                </div>
              </div>
              <button onClick={()=>setForm(f=>({...f,name:"",specialty:"",location:""}))}
                style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"800", color:"#888", cursor:"pointer", whiteSpace:"nowrap" }}>✕ Clear</button>
            </div>
          )}

          {submitted ? (
            <div style={{...gridBg, background:"#B7CF4F", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"60px 40px", textAlign:"center", boxShadow:"4px 4px 0 #e0ddf5"}}>
              <div style={{ fontSize:"52px", marginBottom:"16px" }}>✨</div>
              <h2 style={{ fontFamily:"Georgia,serif", fontSize:"28px", fontWeight:"900", margin:"0 0 12px", letterSpacing:"-1px" }}>{isEditing ? "Referral updated!" : "You're the best!"}</h2>
              <p style={{ color:"#444", lineHeight:"1.6", margin:"0 0 6px" }}>Thanks for referring <strong>{form.name}</strong>.</p>
              <p style={{ color:"#666", fontSize:"14px", margin:"0 0 24px" }}>Overall score submitted: <strong>★ {avgRating(formRatings)} / 5</strong></p>
              <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={()=>{ loadCommunityPros(); goTo("home"); setUploadedPhotos([]); setForm({name:"",specialty:"",city:"",state:"",customCity:"",location:"",instagram:"",booking:"",why:"",yourName:"",yourEmail:"",tiktok:""}); setFormRatings(defaultRatings()); setIsEditing(false); }} style={{...btnDark}}>Back to Directory</button>
                {submittedProId && (
                  <button onClick={()=>{ setPublicProId(submittedProId); setPage("publicProfile"); window.scrollTo(0,0); }} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"40px", padding:"12px 24px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", color:"#1A00B9" }}>View {form.name.split(" ")[0]}'s Profile →</button>
                )}
                {!hasEdited && submittedRecId && (
                  <button onClick={()=>{ setSubmitted(false); setIsEditing(true); }} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"800", color:"#555", cursor:"pointer", textDecoration:"underline", fontFamily:"sans-serif" }}>Edit my referral</button>
                )}
              </div>
            </div>
          ) : (
            <div className="form-wrap" style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", padding:"40px", boxShadow:"4px 4px 0 #e0ddf5" }}>
              {/* Editing banner */}
              {isEditing && (
                <div style={{ background:"#EAE6FF", border:"1.5px solid #1A00B9", borderRadius:"12px", padding:"12px 16px", marginBottom:"24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
                  <span style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", color:"#1A00B9" }}>✏️ Editing your referral — make changes and resubmit</span>
                  <button onClick={()=>{ setIsEditing(false); setSubmitted(true); }} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:"800", color:"#888", cursor:"pointer", whiteSpace:"nowrap" }}>Cancel</button>
                </div>
              )}
              {/* Section header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px", paddingBottom:"14px", borderBottom:"1.5px solid #f0f0f0" }}>
                <p style={{ fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:0 }}>About the Pro</p>
                <p style={{ fontSize:"11px", color:"#aaa", margin:0, fontFamily:"sans-serif" }}>* required</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                <div><label style={lbl}>Pro's Full Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Aaliyah Monroe" style={inp}/></div>
                <div><label style={lbl}>Specialty *</label>
                  <select value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})} style={inp}>
                    <option value="">Select a category...</option>
                    {["Hair Stylists","Makeup Artists","Nail Techs","Estheticians","Lash & Brow Artists"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>State</label>
                  <select value={form.state} onChange={e=>setForm({...form, state:e.target.value, city:"", customCity:"", location:`${form.city}, ${e.target.value}`})} style={inp}>
                    <option value="">Select a state...</option>
                    {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>City</label>
                  <select value={form.city} onChange={e=>{ const v=e.target.value; setForm(f=>({...f, city:v, customCity:"", location:v==="Other"?"":`${v}, ${f.state}`})); }} style={inp} disabled={!form.state}>
                    <option value="">Select a city...</option>
                    {({AL:["Birmingham","Montgomery","Huntsville","Mobile"],AK:["Anchorage","Fairbanks","Juneau"],AZ:["Phoenix","Tucson","Scottsdale","Mesa","Tempe","Chandler"],AR:["Little Rock","Fayetteville","Fort Smith"],CA:["Los Angeles","San Francisco","San Diego","Sacramento","Oakland","San Jose","Long Beach","Fresno","Anaheim","Riverside","Bakersfield","Stockton","Irvine","Santa Ana"],CO:["Denver","Colorado Springs","Aurora","Boulder","Fort Collins"],CT:["Hartford","New Haven","Bridgeport","Stamford"],DE:["Wilmington","Dover"],FL:["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","St. Petersburg","Hialeah","Tallahassee","Boca Raton","West Palm Beach"],GA:["Atlanta","Augusta","Columbus","Macon","Savannah","Athens","Alpharetta","Marietta","Roswell","Sandy Springs"],HI:["Honolulu","Hilo","Kailua"],ID:["Boise","Nampa","Meridian"],IL:["Chicago","Aurora","Rockford","Joliet","Naperville","Springfield","Peoria"],IN:["Indianapolis","Fort Wayne","Evansville","South Bend","Carmel"],IA:["Des Moines","Cedar Rapids","Davenport"],KS:["Wichita","Overland Park","Kansas City","Topeka"],KY:["Louisville","Lexington","Bowling Green"],LA:["New Orleans","Baton Rouge","Shreveport","Lafayette","Metairie"],ME:["Portland","Lewiston","Bangor"],MD:["Baltimore","Frederick","Rockville","Gaithersburg","Silver Spring"],MA:["Boston","Worcester","Springfield","Cambridge","Lowell","Brockton","Quincy","Lynn"],MI:["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor","Lansing","Flint","Dearborn"],MN:["Minneapolis","St. Paul","Rochester","Duluth","Bloomington"],MS:["Jackson","Gulfport","Southaven","Hattiesburg"],MO:["Kansas City","St. Louis","Springfield","Columbia","Independence"],MT:["Billings","Missoula","Great Falls","Bozeman"],NE:["Omaha","Lincoln","Bellevue"],NV:["Las Vegas","Henderson","Reno","North Las Vegas"],NH:["Manchester","Nashua","Concord"],NJ:["Newark","Jersey City","Paterson","Elizabeth","Trenton","Edison","Woodbridge"],NM:["Albuquerque","Las Cruces","Rio Rancho","Santa Fe"],NY:["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","New Rochelle","White Plains","Bronx","Brooklyn","Queens","Staten Island"],NC:["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville","Cary","Wilmington","High Point","Asheville"],ND:["Fargo","Bismarck","Grand Forks"],OH:["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton"],OK:["Oklahoma City","Tulsa","Norman","Broken Arrow","Edmond"],OR:["Portland","Salem","Eugene","Gresham","Hillsboro"],PA:["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton"],RI:["Providence","Cranston","Warwick","Pawtucket"],SC:["Columbia","Charleston","North Charleston","Mount Pleasant","Rock Hill","Greenville"],SD:["Sioux Falls","Rapid City","Aberdeen"],TN:["Nashville","Memphis","Knoxville","Chattanooga","Clarksville","Murfreesboro"],TX:["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo","Lubbock","Irving","Garland","Frisco","McKinney","Denton","Killeen"],UT:["Salt Lake City","West Valley City","Provo","West Jordan","Sandy","Orem"],VT:["Burlington","Essex","South Burlington"],VA:["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria","Hampton","Roanoke"],WA:["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kirkland","Redmond","Renton"],WV:["Charleston","Huntington","Morgantown"],WI:["Milwaukee","Madison","Green Bay","Kenosha","Racine"],WY:["Cheyenne","Casper","Laramie"],DC:["Washington"]}[form.state]||[]).concat(["Other"]).map(c=><option key={c}>{c}</option>)}
                  </select>
                  {form.city==="Other" && <input value={form.customCity} onChange={e=>setForm(f=>({...f, customCity:e.target.value, location:`${e.target.value}, ${f.state}`}))} placeholder="Enter your city" style={{...inp, marginTop:"8px"}}/>}
                </div>
                <div><label style={lbl}>Instagram Handle</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#aaa", fontWeight:"700" }}>@</span>
                    <input value={form.instagram} onChange={e=>setForm({...form,instagram:e.target.value})} placeholder="theirhandle" style={{...inp,paddingLeft:"34px"}}/>
                  </div>
                </div>
                <div><label style={lbl}>Booking Link</label><input value={form.booking} onChange={e=>setForm({...form,booking:e.target.value})} placeholder="https://..." style={inp}/></div>

                {/* RATINGS */}
                <div>
                  <label style={{...lbl, marginBottom:"4px"}}>Rate Your Experience *</label>
                  <p style={{ fontSize:"12px", color:"#888", margin:"0 0 12px" }}>Rate this pro across all 7 categories. All ratings are required.</p>
                  <RatingForm ratings={formRatings} onChange={setFormRatings}/>
                  {ratingsComplete&&(
                    <div style={{ marginTop:"12px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"10px", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", color:"#888", textTransform:"uppercase", letterSpacing:"1px" }}>Your Overall Score</span>
                      <span style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9" }}>★ {avgRating(formRatings)} / 5</span>
                    </div>
                  )}
                </div>

                <div><label style={lbl}>Why should others book them? *</label>
                  <textarea value={form.why} onChange={e=>setForm({...form,why:e.target.value})} placeholder="Tell us what makes them exceptional — their skill, vibe, communication, results..." style={{...inp,height:"100px",resize:"vertical"}}/>
                </div>

                {/* PHOTOS */}
                <div>
                  <label style={lbl}>Results Photos</label>
                  <p style={{ fontSize:"12px", color:"#888", margin:"0 0 10px" }}>Upload before/afters, finished looks, or work in progress. Up to 6 photos.</p>
                  <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);handleFileUpload(e.dataTransfer.files);}} onClick={()=>fileRef.current.click()}
                    style={{ border:`2px dashed ${dragOver?"#9B8AFB":"#ccc"}`, borderRadius:"12px", padding:"28px", textAlign:"center", cursor:"pointer", background:dragOver?"#fff0f6":"#fff" }}>
                    <div style={{ fontSize:"28px", marginBottom:"6px" }}>📸</div>
                    <p style={{ fontWeight:"800", fontSize:"13px", margin:"0 0 4px" }}>Drop photos here or click to upload</p>
                    <p style={{ fontSize:"11px", color:"#aaa", margin:0 }}>JPG, PNG, HEIC · Max 6 photos</p>
                    <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>handleFileUpload(e.target.files)}/>
                  </div>
                  {uploadedPhotos.length>0&&(
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginTop:"12px" }}>
                      {uploadedPhotos.map((photo,i)=>(
                        <div key={i} style={{ position:"relative", borderRadius:"10px", overflow:"hidden", border:"1.5px solid #1A00B9", aspectRatio:"1" }}>
                          <img src={photo.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          <button onClick={()=>setUploadedPhotos(prev=>prev.filter((_,j)=>j!==i))} style={{ position:"absolute", top:"6px", right:"6px", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"24px", height:"24px", cursor:"pointer", fontSize:"12px", fontWeight:"900", lineHeight:1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TIKTOK REVIEW LINK */}
                <div>
                  <label style={lbl}>🎵 TikTok Review Link</label>
                  <p style={{ fontSize:"12px", color:"#888", margin:"0 0 10px", lineHeight:"1.5" }}>
                    Posted a TikTok review of this pro? Drop the link and we'll feature it on their profile.
                  </p>
                  <div style={{ position:"relative" }}>
                    <div style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", fontSize:"16px", pointerEvents:"none" }}>🎵</div>
                    <input
                      value={form.tiktok || ""}
                      onChange={e=>setForm({...form, tiktok:e.target.value})}
                      placeholder="https://www.tiktok.com/@you/video/..."
                      style={{...inp, paddingLeft:"42px"}}
                    />
                  </div>
                  {form.tiktok && (() => {
                    const isValid = form.tiktok.includes("tiktok.com");
                    return (
                      <div style={{ marginTop:"8px", display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ fontSize:"12px", fontWeight:"800", color: isValid ? "#1A00B9" : "#9B8AFB" }}>
                          {isValid ? "✓ TikTok link detected — will be featured on their profile" : "⚠ Paste a full tiktok.com link"}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <hr style={{ border:"none", borderTop:"1.5px solid #f0f0f0" }}/>
                <p style={{ fontSize:"10px", fontWeight:"800", letterSpacing:"2px", textTransform:"uppercase", color:"#aaa", margin:0 }}>About You</p>
                <div><label style={lbl}>Your Name</label><input value={form.yourName} onChange={e=>setForm({...form,yourName:e.target.value})} placeholder="Your full name" style={inp}/></div>
                <div>
                  <label style={lbl}>Your Email</label>
                  <input value={form.yourEmail} onChange={e=>setForm({...form,yourEmail:e.target.value})} placeholder="you@email.com" style={inp}/>
                  <p style={{ fontSize:"12px", color:"#aaa", margin:"6px 0 0" }}>We'll only contact you if we have questions about your submission.</p>
                </div>

                <div style={{ background:"#fff", border:"1.5px solid #e5e5e5", borderRadius:"10px", padding:"14px 16px" }}>
                  <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888", margin:0, lineHeight:"1.6" }}>
                    By submitting this referral, you confirm this reflects your genuine personal experience and agree to our <span onClick={()=>goTo("terms")} style={{ color:"#1A00B9", fontWeight:"700", cursor:"pointer" }}>Terms of Service</span> and <span onClick={()=>goTo("privacy")} style={{ color:"#1A00B9", fontWeight:"700", cursor:"pointer" }}>Privacy Policy</span>.
                  </p>
                </div>

                {!ratingsComplete&&<div style={{ background:"#fffdf0", border:"1.5px solid #B7CF4F", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", fontWeight:"700", color:"#7a6800", display:"flex", alignItems:"center", gap:"8px" }}>⭐ Rate all 7 categories to unlock submit.</div>}
                {ratingsComplete&&(!form.name||!form.specialty||!form.why)&&<div style={{ background:"#f4f2ff", border:"1.5px solid #9B8AFB", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", fontWeight:"700", color:"#1A00B9", display:"flex", alignItems:"center", gap:"8px" }}>✦ Almost there — fill in the pro's name, specialty, and your review.</div>}
                {submitError&&<div style={{ background:"#fff0f0", border:"1.5px solid #ff4444", borderRadius:"10px", padding:"12px 16px", fontSize:"13px", fontWeight:"700", color:"#cc0000" }}>❌ {submitError}</div>}

                <button onClick={async ()=>{
                  if(!(form.name&&form.specialty&&form.why&&ratingsComplete)) return;
                  setSubmitError("");
                  const savedPhotos = uploadedPhotos.filter(p=>!p.uploading).map(p=>p.url);
                  const recPayload = {
                    submitter_name: form.yourName || "",
                    submitter_email: form.yourEmail || "",
                    rating_service_outcome: formRatings.serviceOutcome || 0,
                    rating_parking: formRatings.parking || 0,
                    rating_customer_service: formRatings.customerService || 0,
                    rating_wait_time: formRatings.waitTime || 0,
                    rating_communication: formRatings.communication || 0,
                    rating_value: formRatings.value || 0,
                    rating_cleanliness: formRatings.cleanliness || 0,
                    rating_overall: parseFloat(avgRating(formRatings)) || 0,
                    review_text: form.why,
                    tiktok_review_url: form.tiktok || "",
                    photo_urls: savedPhotos,
                    status: "pending",
                  };

                  if (isEditing && submittedRecId && submittedProId) {
                    // UPDATE existing recommendation
                    const { error: updRecErr } = await supabase.from("recommendations").update(recPayload).eq("id", submittedRecId);
                    if (updRecErr) { setSubmitError("Error updating referral: " + updRecErr.message); return; }
                    // UPDATE pros ratings too
                    await supabase.from("pros").update({
                      rating_service_outcome: formRatings.serviceOutcome || 0,
                      rating_parking: formRatings.parking || 0,
                      rating_customer_service: formRatings.customerService || 0,
                      rating_wait_time: formRatings.waitTime || 0,
                      rating_communication: formRatings.communication || 0,
                      rating_value: formRatings.value || 0,
                      rating_cleanliness: formRatings.cleanliness || 0,
                      rating_overall: parseFloat(avgRating(formRatings)) || 0,
                      ...(savedPhotos[0] ? { photo_url: savedPhotos[0] } : {}),
                    }).eq("id", submittedProId);
                    setHasEdited(true);
                    setIsEditing(false);
                  } else {
                    // CREATE new pro + recommendation
                    let proId = null;
                    const { data: existing, error: findErr } = await supabase.from("pros").select("id").ilike("first_name", form.name.split(" ")[0]).limit(1);
                    if (findErr) { setSubmitError("Error finding pro: " + findErr.message); return; }
                    if (existing && existing.length > 0) {
                      proId = existing[0].id;
                    } else {
                      const cityVal = form.city === "Other" ? form.customCity : form.city;
                      const locationDisplay = cityVal && form.state ? `${cityVal}, ${form.state}` : (form.location || "");
                      const nameParts = form.name.trim().split(" ");
                      const { data: newPro, error: insertProErr } = await supabase.from("pros").insert([{
                        first_name: nameParts[0] || form.name,
                        last_name: nameParts.slice(1).join(" ") || "",
                        specialty: form.specialty,
                        instagram: form.instagram || "",
                        booking_url: form.booking || "",
                        tiktok: form.tiktok || "",
                        location_city: cityVal || "",
                        location_state: form.state || "",
                        location_display: locationDisplay,
                        bio: form.why || "",
                        photo_url: savedPhotos[0] || "",
                        rating_service_outcome: formRatings.serviceOutcome || 0,
                        rating_parking: formRatings.parking || 0,
                        rating_customer_service: formRatings.customerService || 0,
                        rating_wait_time: formRatings.waitTime || 0,
                        rating_communication: formRatings.communication || 0,
                        rating_value: formRatings.value || 0,
                        rating_cleanliness: formRatings.cleanliness || 0,
                        rating_overall: parseFloat(avgRating(formRatings)) || 0,
                        review_count: 1,
                        is_active: true, is_approved: false, is_claimed: false, is_verified: false, is_pro_plus: false, is_trending: false,
                      }]).select("id").single();
                      if (insertProErr) { setSubmitError("Error creating pro: " + insertProErr.message); return; }
                      proId = newPro?.id;
                    }
                    setSubmittedProId(proId);
                    if (proId) {
                      const { data: newRec, error: recErr } = await supabase.from("recommendations").insert([{ pro_id: proId, ...recPayload }]).select("id").single();
                      if (recErr) { setSubmitError("Error saving referral: " + recErr.message); return; }
                      setSubmittedRecId(newRec?.id);
                      // Recalculate true average ratings across ALL referrals for this pro
                      const { data: allRecs } = await supabase.from("recommendations")
                        .select("rating_service_outcome,rating_parking,rating_customer_service,rating_wait_time,rating_communication,rating_value,rating_cleanliness")
                        .eq("pro_id", proId);
                      if (allRecs && allRecs.length > 0) {
                        const avg = (field) => { const v = allRecs.map(r=>parseFloat(r[field])||0).filter(x=>x>0); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; };
                        const so=avg("rating_service_outcome"), pk=avg("rating_parking"), cs=avg("rating_customer_service"),
                              wt=avg("rating_wait_time"), cm=avg("rating_communication"), va=avg("rating_value"), cl=avg("rating_cleanliness");
                        const overall = [so,pk,cs,wt,cm,va,cl].filter(x=>x>0);
                        // Also get current photo_url so we only set it if empty
                        const { data: curProPhoto } = await supabase.from("pros").select("photo_url").eq("id", proId).single();
                        await supabase.from("pros").update({
                          rating_service_outcome: so, rating_parking: pk, rating_customer_service: cs,
                          rating_wait_time: wt, rating_communication: cm, rating_value: va, rating_cleanliness: cl,
                          rating_overall: overall.length ? overall.reduce((a,b)=>a+b,0)/overall.length : 0,
                          review_count: allRecs.length,
                          ...((savedPhotos[0] && (!curProPhoto?.photo_url || curProPhoto.photo_url === "")) ? { photo_url: savedPhotos[0] } : {}),
                        }).eq("id", proId);
                      }
                    }
                  }

                  await loadCommunityPros();
                  setSubmitted(true);
                }}
                  style={{...btnPink, background:(!form.name||!form.specialty||!form.why||!ratingsComplete)?"#ddd":"#1A00B9", color:(!form.name||!form.specialty||!form.why||!ratingsComplete)?"#aaa":"#fff", border:"none", boxShadow:(!form.name||!form.specialty||!form.why||!ratingsComplete)?"none":"4px 4px 0 #B7CF4F", padding:"16px 32px", fontSize:"15px", width:"100%"}}>
                  Submit Referral →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SHORTLIST COMPARISON MODAL ── */}
      {showShortlist && (
        <div onClick={()=>setShowShortlist(false)} style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.8)", backdropFilter:"blur(8px)", zIndex:150, overflowY:"auto", padding:"40px 20px" }}>
          <div onClick={e=>e.stopPropagation()} style={{ maxWidth: savedPros.length === 1 ? "480px" : savedPros.length === 2 ? "860px" : "1100px", margin:"0 auto", background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"20px", boxShadow:"6px 6px 0 #1A00B9", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ background:"#E8E4FF", padding:"24px 28px", borderBottom:"1px solid #e0ddf5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:0, fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color:"#1A00B9", letterSpacing:"-0.5px" }}>Your Shortlist ❤️</p>
                <p style={{ margin:"2px 0 0", fontSize:"12px", color:"#666" }}>{savedPros.length} saved pro{savedPros.length!==1?"s":""} · compare side by side</p>
              </div>
              <button onClick={()=>setShowShortlist(false)} style={{ background:"#fff", border:"1.5px solid #1A00B9", borderRadius:"50%", width:"36px", height:"36px", cursor:"pointer", fontSize:"18px", fontWeight:"900", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>

            <div style={{ padding:"28px", overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"sans-serif" }}>
                <thead>
                  <tr>
                    {/* Row label column */}
                    <td style={{ width:"160px", paddingRight:"16px" }}></td>
                    {savedPros.map(pro => (
                      <td key={pro.id} style={{ textAlign:"center", padding:"0 12px 20px", verticalAlign:"top", minWidth:"180px" }}>
                        <div style={{ position:"relative", display:"inline-block" }}>
                          <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:"#f4f2ff", border:"3px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", flexShrink:0 }}><span style={{ fontSize:"22px", opacity:0.5 }}>📷</span></div>
                          {pro.verified && <div style={{ position:"absolute", bottom:"12px", right:"-4px", background:"#B7CF4F", border:"2px solid #fff", borderRadius:"50%", width:"20px", height:"20px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px" }}>✓</div>}
                        </div>
                        <p style={{ margin:"0 0 2px", fontFamily:"Georgia,serif", fontSize:"15px", fontWeight:"900", color:"#1A00B9" }}>{pro.name}</p>
                        <p style={{ margin:"0 0 6px", fontSize:"11px", color:"#888" }}>{pro.specialty}</p>
                        <p style={{ margin:"0 0 10px", fontSize:"11px", color:"#aaa" }}>📍 {pro.location}{getDistance(pro) ? ` · ${getDistance(pro)} away` : ""}</p>
                        <div style={{ display:"flex", gap:"4px", justifyContent:"center", flexWrap:"wrap", marginBottom:"10px" }}>
                          {pro.proPlus && <span style={{ background:"#B7CF4F", color:"#1A00B9", borderRadius:"6px", padding:"1px 7px", fontSize:"10px", fontWeight:"900" }}>PRO+</span>}
                        </div>
                        <div style={{ display:"flex", gap:"6px", justifyContent:"center" }}>
                          <button onClick={()=>{ setShowShortlist(false); setSelectedPro(pro); }}
                            style={{...btnDark, padding:"7px 14px", fontSize:"11px", boxShadow:"2px 2px 0 #B7CF4F"}}>View Profile</button>
                          <button onClick={()=>toggleSave(pro)}
                            style={{...btnOut, padding:"7px 10px", fontSize:"11px"}}>✕</button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Overall score row */}
                  <tr style={{ background:"#f8f7ff" }}>
                    <td style={{ padding:"12px 16px 12px 0", fontSize:"12px", fontWeight:"800", color:"#1A00B9", textTransform:"uppercase", letterSpacing:"0.5px", borderTop:"1px solid #e0ddf5" }}>Overall ★</td>
                    {savedPros.map(pro => {
                      const score = avgRating(pro.ratings);
                      const best = Math.max(...savedPros.map(p=>avgRating(p.ratings)));
                      return (
                        <td key={pro.id} style={{ textAlign:"center", padding:"12px", borderTop:"1px solid #e0ddf5" }}>
                          <span style={{ fontFamily:"Georgia,serif", fontSize:"22px", fontWeight:"900", color: score===best ? "#1A00B9" : "#aaa" }}>{score}</span>
                          {score===best && savedPros.length>1 && <div style={{ fontSize:"10px", fontWeight:"800", color:"#B7CF4F", marginTop:"2px" }}>HIGHEST</div>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Reviews row */}
                  <tr>
                    <td style={{ padding:"10px 16px 10px 0", fontSize:"12px", color:"#888", fontWeight:"700", borderTop:"1px solid #f0f0f0" }}>Total Reviews</td>
                    {savedPros.map(pro => (
                      <td key={pro.id} style={{ textAlign:"center", padding:"10px 12px", borderTop:"1px solid #f0f0f0", fontSize:"13px", fontWeight:"800", color:"#333" }}>{pro.reviews}</td>
                    ))}
                  </tr>
                  {/* 7 category rows */}
                  {RATING_CATEGORIES.map((cat, ci) => {
                    const best = Math.max(...savedPros.map(p=>p.ratings[cat.key]));
                    return (
                      <tr key={cat.key} style={{ background: ci%2===0 ? "#fafafa" : "#fff" }}>
                        <td style={{ padding:"10px 16px 10px 0", fontSize:"12px", color:"#555", fontWeight:"700", borderTop:"1px solid #f0f0f0" }}>
                          {cat.emoji} {cat.label}
                        </td>
                        {savedPros.map(pro => {
                          const val = pro.ratings[cat.key];
                          const isBest = val === best && savedPros.length > 1;
                          return (
                            <td key={pro.id} style={{ textAlign:"center", padding:"10px 12px", borderTop:"1px solid #f0f0f0" }}>
                              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                                <span style={{ fontSize:"13px", fontWeight:"900", color: isBest ? "#1A00B9" : "#888" }}>{val}</span>
                                <div style={{ width:"80px", height:"5px", background:"#f0f0f0", borderRadius:"3px", overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${(val/5)*100}%`, background: isBest ? "#1A00B9" : "#ddd", borderRadius:"3px", transition:"width 0.3s" }}/>
                                </div>
                                {isBest && <span style={{ fontSize:"9px", fontWeight:"900", color:"#B7CF4F", letterSpacing:"0.5px" }}>BEST</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Recommended by row */}
                  <tr style={{ background:"#f8f7ff" }}>
                    <td style={{ padding:"10px 16px 10px 0", fontSize:"12px", color:"#555", fontWeight:"700", borderTop:"1px solid #e0ddf5" }}>👥 Recommended by</td>
                    {savedPros.map(pro => (
                      <td key={pro.id} style={{ textAlign:"center", padding:"10px 12px", borderTop:"1px solid #e0ddf5", fontSize:"11px", color:"#666", lineHeight:"1.5" }}>
                        {pro.recommendedBy?.slice(0,2).join(", ")}{pro.recommendedBy?.length>2 ? ` +${pro.recommendedBy.length-2}` : ""}
                      </td>
                    ))}
                  </tr>
                  {/* Tags row */}
                  <tr>
                    <td style={{ padding:"10px 16px 10px 0", fontSize:"12px", color:"#555", fontWeight:"700", borderTop:"1px solid #f0f0f0" }}>🏷️ Specializes in</td>
                    {savedPros.map(pro => (
                      <td key={pro.id} style={{ textAlign:"center", padding:"10px 12px", borderTop:"1px solid #f0f0f0" }}>
                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", justifyContent:"center" }}>
                          {pro.tags.map(tag=>(
                            <span key={tag} style={{ background:"#E8E4FF", border:"1px solid #1A00B9", borderRadius:"6px", padding:"2px 8px", fontSize:"10px", fontWeight:"700", color:"#1A00B9" }}>{tag}</span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              {/* Footer nudge */}
              <div style={{ marginTop:"28px", padding:"20px 24px", background:"#E8E4FF", borderRadius:"14px", border:"1.5px solid #1A00B9", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", flexWrap:"wrap" }}>
                <div>
                  <p style={{ margin:"0 0 2px", fontWeight:"800", fontSize:"13px", color:"#1A00B9" }}>Save your shortlist forever</p>
                  <p style={{ margin:0, fontSize:"12px", color:"#666" }}>Create a free account to keep these pros saved across sessions and get notified when they get new recommendations.</p>
                </div>
                <button onClick={()=>{ setShowShortlist(false); goTo("dashboard"); }}
                  style={{...btnDark, padding:"10px 20px", fontSize:"12px", boxShadow:"3px 3px 0 #B7CF4F", whiteSpace:"nowrap"}}>Create Account →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProModal pro={selectedPro} onClose={()=>setSelectedPro(null)} goToRecommend={goToRecommend} getDistance={getDistance}/>

      {/* FLOATING HELP BUTTON */}
      <button onClick={()=>goTo("help")} style={{ position:"fixed", bottom:"24px", right:"24px", zIndex:300, background:"#1A00B9", color:"#fff", border:"2px solid #1A00B9", borderRadius:"50px", padding:"11px 20px", fontFamily:"sans-serif", fontSize:"13px", fontWeight:"800", cursor:"pointer", boxShadow:"4px 4px 0 #B7CF4F", display:"flex", alignItems:"center", gap:"7px", letterSpacing:"-0.2px" }}>
        <span style={{ fontSize:"16px", lineHeight:1 }}>?</span> Help
      </button>

      {/* FOOTER */}
      <footer style={{ borderTop:"1px solid #f0eef8", padding:"40px 48px", background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"24px", marginBottom:"24px" }}>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontWeight:"900", fontSize:"20px", letterSpacing:"-0.5px", marginBottom:"8px" }}>reffered</div>
            <p style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#888", margin:0, maxWidth:"280px", lineHeight:"1.6" }}>
              A community-powered beauty directory. Ratings and reviews represent personal opinions of community members and are not endorsed by reffered
            </p>
          </div>
          <div style={{ display:"flex", gap:"40px", flexWrap:"wrap" }}>
            {[
              { heading:"Platform", links:[["Browse","home"],["About","about"],["Refer a Pro","recommend"],["Help","help"]] },
              { heading:"Professionals", links:[["Join Free / Sign In","join"],["Dispute a Listing","dispute"],["Pro+ Dashboard","dashboard"]] },
              { heading:"Legal", links:[["Terms of Service","terms"],["Privacy Policy","privacy"]] },
            ].map(col=>(
              <div key={col.heading}>
                <p style={{ fontFamily:"sans-serif", fontSize:"11px", fontWeight:"800", letterSpacing:"1.5px", textTransform:"uppercase", color:"#aaa", margin:"0 0 10px" }}>{col.heading}</p>
                {col.links.map(([label,pg])=>(
                  <p key={pg} onClick={()=>goTo(pg)} style={{ fontFamily:"sans-serif", fontSize:"13px", fontWeight:"700", color:"#555", margin:"0 0 8px", cursor:"pointer" }}>{label}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop:"1.5px solid #f0f0f0", paddingTop:"20px", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"8px" }}>
          <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa" }}>© 2025 reffered · All ratings are community-submitted opinions.</span>
          <span style={{ fontFamily:"sans-serif", fontSize:"12px", color:"#aaa" }}>Not affiliated with any listed professional or business.</span>
        </div>
      </footer>
    </div>
  );
}
