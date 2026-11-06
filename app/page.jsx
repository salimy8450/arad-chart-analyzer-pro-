"use client";
import { useState } from "react";

export default function Home() {
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState("");
  const [symbol,setSymbol] = useState("");
  const [timeframe,setTimeframe] = useState("15m");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState(null);

  function chooseFile(e) {
    const f=e.target.files?.[0]; setError(""); setResult(null);
    if(!f) return;
    if(!["image/png","image/jpeg","image/webp"].includes(f.type)){setError("فقط تصویر PNG، JPG یا WEBP مجاز است.");return;}
    if(f.size>6*1024*1024){setError("حجم تصویر باید کمتر از ۶ مگابایت باشد.");return;}
    setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function analyze() {
    if(!file){setError("ابتدا تصویر چارت را انتخاب کن.");return;}
    setLoading(true);setError("");setResult(null);
    try {
      const imageData=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageData,symbol,timeframe})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||"تحلیل انجام نشد.");
      setResult(data.analysis);
    } catch(e){setError(e.message||"خطا در ارتباط با سرور.");} finally{setLoading(false);}
  }
  return <main className="shell">
    <header className="top"><div className="logo">A</div><div><b>ARAD <span>CHART ANALYZER PRO</span></b><small>تحلیل هوشمند نمودار بازار</small></div><label className="tag">AI ANALYZER</label></header>
    <section className="hero"><small>SMART CHART INTELLIGENCE</small><h1>چارتت رو آپلود کن،<br/><em>تحلیلش با آراد</em></h1><p>تصویر نمودار را بفرست تا روند و سناریوهای احتمالی معامله بررسی شوند.</p></section>
    <section className="panel"><h2>۱. تصویر نمودار</h2><label className="upload">{preview?<img src={preview} alt="پیش‌نمایش چارت"/>:<div className="placeholder"><strong>＋</strong><b>انتخاب تصویر چارت</b><small>PNG، JPG یا WEBP · حداکثر ۶ مگابایت</small></div>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile}/></label>
    <div className="fields"><label>نماد ارز<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="مثلاً BTCUSDT (اختیاری)" dir="ltr"/></label><label>تایم‌فریم<select value={timeframe} onChange={e=>setTimeframe(e.target.value)}><option value="5m">۵ دقیقه</option><option value="15m">۱۵ دقیقه</option><option value="1h">۱ ساعت</option><option value="4h">۴ ساعت</option><option value="1d">روزانه</option></select></label></div>
    <button onClick={analyze} disabled={loading||!file}>{loading?"در حال تحلیل تصویر…":"تحلیل هوشمند چارت ←"}</button>{error&&<p className="error">{error}</p>}<small className="privacy">🔒 کلید API در مرورگر قرار نمی‌گیرد.</small></section>
    {result&&<section className="panel"><div className="resultHead"><h2>گزارش تحلیل</h2><b className={"decision "+result.decision}>{result.decision==="LONG"?"خرید / LONG":result.decision==="SHORT"?"فروش / SHORT":"انتظار / WAIT"}</b></div>
      <div className="stats"><div>نماد<b dir="ltr">{result.symbol||symbol||"—"}</b></div><div>تایم‌فریم<b>{result.timeframe||timeframe}</b></div><div>وضوح شواهد<b>{result.confidence}٪</b></div><div>روند<b>{result.trend||"—"}</b></div></div>
      <div className="levels"><div>ورود<b>{result.entry||"—"}</b></div><div>حد ضرر<b className="loss">{result.stop_loss||"—"}</b></div>{(result.targets||[]).slice(0,5).map((t,i)=><div key={i}>هدف TP{i+1}<b className="profit">{t}</b></div>)}</div>
      <h3>دلایل تحلیل</h3><ul>{(result.reasons||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><p className="warning">ابطال سناریو: {result.invalidation||"—"}<br/>{result.caution||"تحلیل آموزشی است و تضمین سود نیست."}</p>
    </section>}
    <footer>ARAD CHART ANALYZER PRO · نسخه آزمایشی ۰.۱<br/>ابزار کمکی تحلیل؛ نه توصیه مالی و نه تضمین سود.</footer>
  </main>;
}