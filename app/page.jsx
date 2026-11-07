"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [authenticated,setAuthenticated] = useState(false);
  const [checking,setChecking] = useState(true);
  const [password,setPassword] = useState("");
  const [loginError,setLoginError] = useState("");
  const [remaining,setRemaining] = useState(3);
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState("");
  const [symbol,setSymbol] = useState("");
  const [timeframe,setTimeframe] = useState("15m");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState(null);

  async function refreshQuota() {
    const res = await fetch("/api/quota", { cache: "no-store" });
    if (res.status === 401) { setAuthenticated(false); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "خواندن سهمیه ناموفق بود.");
    setRemaining(data.remaining);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setAuthenticated(true);
          setRemaining(data.remaining);
        }
      } catch {} finally { setChecking(false); }
    })();
  }, []);

  async function login(e) {
    e.preventDefault(); setLoginError("");
    try {
      const res = await fetch("/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ورود انجام نشد.");
      setAuthenticated(true); setPassword("");
      await refreshQuota();
    } catch (e) { setLoginError(e.message || "خطا در ورود."); }
  }

  function chooseFile(e) {
    const f=e.target.files?.[0]; setError(""); setResult(null);
    if(!f) return;
    if(!["image/png","image/jpeg","image/webp"].includes(f.type)){setError("فقط تصویر PNG، JPG یا WEBP مجاز است.");return;}
    if(f.size>6*1024*1024){setError("حجم تصویر باید کمتر از ۶ مگابایت باشد.");return;}
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  async function prepareChartImage(sourceFile) {
    // Normalize EXIF orientation when the browser supports it.
    // If decoding fails on an older phone, safely fall back to the original file.
    try {
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(sourceFile, { imageOrientation: "from-image" });
        const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("آماده‌سازی تصویر ممکن نشد.");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        return canvas.toDataURL("image/jpeg", 0.94);
      }
    } catch (err) {
      console.warn("Image normalization fallback:", err);
    }
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error("خواندن تصویر ناموفق بود."));
      reader.readAsDataURL(sourceFile);
    });
  }

  async function analyze() {
    if(!file){setError("ابتدا تصویر چارت را انتخاب کن.");return;}
    if(remaining <= 0){setError("سهمیه امروز تمام شده است. فردا دوباره تلاش کن.");return;}
    setLoading(true);setError("");setResult(null);
    try {
      const imageData=await prepareChartImage(file);
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageData,symbol,timeframe})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||"تحلیل انجام نشد.");
      setResult(data.analysis);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch(e){setError(e.message||"خطا در ارتباط با سرور."); try { await refreshQuota(); } catch {} } finally{setLoading(false);}
  }

  if (checking) return <main className="shell"><section className="panel">در حال بررسی ورود…</section></main>;

  if (!authenticated) return <main className="shell">
    <header className="top"><div className="logo">A</div><div><b>ARAD <span>CHART ANALYZER PRO</span></b><small>ورود شخصی و امن</small></div></header>
    <section className="hero"><small>OWNER ACCESS</small><h1>خوش برگشتی،<br/><em>آراد آماده است</em></h1><p>برای ورود به ابزار شخصی، رمز عبور خود را وارد کن.</p></section>
    <form className="panel" onSubmit={login}><h2>ورود به پنل</h2><label>رمز عبور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="رمز شخصی" autoComplete="current-password" required/></label><button type="submit" disabled={!password}>ورود به سایت ←</button>{loginError&&<p className="error">{loginError}</p>}<small className="privacy">🔒 رمز فقط در سرور بررسی می‌شود و در مرورگر ذخیره نمی‌شود.</small></form>
    <footer>ARAD CHART ANALYZER PRO · دسترسی خصوصی</footer>
  </main>;

  return <main className="shell">
    <header className="top"><div className="logo">A</div><div><b>ARAD <span>CHART ANALYZER PRO</span></b><small>تحلیل هوشمند نمودار بازار</small></div><label className="tag">AI ANALYZER</label></header>
    <section className="hero"><small>SMART CHART INTELLIGENCE</small><h1>چارتت رو آپلود کن،<br/><em>تحلیلش با آراد</em></h1><p>تصویر نمودار را بفرست تا روند و سناریوهای احتمالی معامله بررسی شوند.</p></section>
    <section className="panel"><div className="resultHead"><h2>۱. تصویر نمودار</h2><b className="tag">سهمیه امروز: {remaining} از ۳</b></div><label className="upload">{preview?<img src={preview} alt="پیش‌نمایش چارت"/>:<div className="placeholder"><strong>＋</strong><b>انتخاب تصویر چارت</b><small>PNG، JPG یا WEBP · حداکثر ۶ مگابایت</small></div>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile}/></label>
    <div className="fields"><label>نماد ارز<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="مثلاً BTCUSDT (اختیاری)" dir="ltr"/></label><label>تایم‌فریم<select value={timeframe} onChange={e=>setTimeframe(e.target.value)}><option value="5m">۵ دقیقه</option><option value="15m">۱۵ دقیقه</option><option value="1h">۱ ساعت</option><option value="4h">۴ ساعت</option><option value="1d">روزانه</option></select></label></div>
    <button onClick={analyze} disabled={loading||!file||remaining<=0}>{loading?"در حال تحلیل تصویر…":remaining<=0?"سهمیه امروز تمام شده":"تحلیل هوشمند چارت ←"}</button>{error&&<p className="error">{error}</p>}<small className="privacy">🔒 کلید API در مرورگر قرار نمی‌گیرد. هر روز ۳ تحلیل مجاز است.</small></section>
    {result&&<section className="panel"><div className="resultHead"><h2>گزارش تحلیل</h2><b className={"decision "+result.decision}>{result.decision==="LONG"?"خرید / LONG":result.decision==="SHORT"?"فروش / SHORT":"انتظار / WAIT"}</b></div>
      <div className="stats"><div>نماد<b dir="ltr">{result.symbol||symbol||"—"}</b></div><div>تایم‌فریم<b>{result.timeframe||timeframe}</b></div><div>وضوح شواهد<b>{result.confidence}٪</b></div><div>روند<b>{result.trend||"—"}</b></div><div>کیفیت تصویر<b>{result.chart_quality||"نامشخص"}</b></div><div>جهت تصویر<b>{result.orientation||"نامشخص"}</b></div></div>
      {result.visible_indicators?.length>0&&<><h3>اندیکاتورهای قابل مشاهده</h3><ul>{result.visible_indicators.map((x,i)=><li key={i}>{x}</li>)}</ul></>}
      {result.market_structure&&<><h3>ساختار بازار</h3><p>{result.market_structure}</p></>}
      <div className="levels"><div>ورود<b>{result.entry||"—"}</b></div><div>حد ضرر<b className="loss">{result.stop_loss||"—"}</b></div>{(result.targets||[]).slice(0,5).map((t,i)=><div key={i}>هدف TP{i+1}<b className="profit">{t}</b></div>)}</div>
      <h3>دلایل تحلیل</h3><ul>{(result.reasons||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><p className="warning">ابطال سناریو: {result.invalidation||"—"}<br/>{result.caution||"تحلیل آموزشی است و تضمین سود نیست."}</p>
    </section>}
    <footer>ARAD CHART ANALYZER PRO · نسخه آزمایشی ۰.۳<br/>ابزار کمکی تحلیل؛ نه توصیه مالی و نه تضمین سود.</footer>
  </main>;
}
