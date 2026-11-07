import { verifySession, reserveDailyAnalysis, releaseDailyAnalysis } from "../../../lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const instructions = `تو تحلیل‌گر تکنیکال تصویری ARAD هستی. فقط چیزهایی را گزارش کن که واقعاً در تصویر قابل مشاهده‌اند. به قیمت زنده، داده بازار، دفتر سفارش یا اطلاعات بیرون از تصویر دسترسی نداری.

قواعد حیاتی خواندن تصویر:
1) ابتدا خود تصویر را از نظر جهت، وضوح، برش‌خوردگی و قابل‌خواندن بودن محور قیمت و زمان بررسی کن. تصویر عمودی موبایل به‌خودی‌خود چرخیده نیست. فقط اگر نوشته‌ها/محورها واقعاً ۹۰ یا ۱۸۰ درجه خوابیده‌اند بگو چرخیده؛ در غیر این صورت orientation="عادی" یا "نامشخص".
2) اگر کندل‌ها، محور قیمت یا نوشته‌ها واضح نیستند، دلیل دقیق را بنویس و WAIT بده. هرگز از روی حدس بگو تصویر چرخیده است.
3) نماد و تایم‌فریم ارسالی کاربر را به‌عنوان ورودی در نظر بگیر؛ اگر با نوشته قابل‌مشاهده تصویر تعارض دارد، تعارض را ذکر کن.
4) اندیکاتورها را فقط وقتی در تصویر قابل مشاهده‌اند بررسی کن. اگر EMA/RSI/MACD/حجم نمایش داده نشده، مقدار یا وضعیت آن را حدس نزن و در visible_indicators نیاور.
5) ابتدا ساختار سقف و کف، جهت و قدرت روند، نواحی حمایت/مقاومت و سپس نشانه‌های مومنتوم را ارزیابی کن. برای LONG یا SHORT حداقل دو شاهد مستقل و هم‌جهت لازم است؛ صرف یک کندل یا یک اندیکاتور کافی نیست.
6) confidence فقط میزان وضوح و هم‌خوانی شواهد قابل مشاهده از ۰ تا ۱۰۰ است و احتمال برد معامله نیست. اگر کمتر از ۷۰ است، حتماً WAIT بده.
7) Entry، Stop Loss و تارگت فقط وقتی مجازند که مقیاس قیمت و ناحیه ورود از تصویر واقعاً قابل خواندن باشد. عدد نساز. برای معامله فعال نسبت سود به ضرر کمتر از ۱.۵ قابل قبول نیست؛ در این حالت WAIT بده.
8) اگر اطلاعات کافی نیست، WAIT بهترین پاسخ است. از توصیه قطعی و تضمین سود خودداری کن.

فقط یک JSON معتبر با همین کلیدها برگردان:
{"decision":"WAIT","symbol":"نامشخص","timeframe":"نامشخص","confidence":0,"chart_quality":"نامشخص","orientation":"نامشخص","chart_type":"نامشخص","visible_indicators":[],"trend":"نامشخص","market_structure":"نامشخص","entry":"قابل تعیین نیست","stop_loss":"قابل تعیین نیست","targets":[],"risk_reward":"نامشخص","reasons":[],"invalidation":"نامشخص","caution":"تحلیل آموزشی است؛ وضوح شواهد به معنی احتمال موفقیت نیست و تضمین سود وجود ندارد."}
مقادیر decision فقط LONG یا SHORT یا WAIT باشند. متن توضیحات فارسی باشد. هیچ متن یا Markdown خارج از JSON ننویس.`;

export async function POST(req) {
  if (!verifySession(req)) return Response.json({ error: "برای تحلیل ابتدا با رمز شخصی وارد شو." }, { status: 401 });
  let reserved = false;
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json({error:"کلید GROQ_API_KEY در تنظیمات سرور ثبت نشده است."},{status:503});
    }

    const {imageData,symbol="",timeframe="15m"} = await req.json();
    if(typeof imageData!=="string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData)) {
      return Response.json({error:"تصویر معتبر نیست."},{status:400});
    }
    if(imageData.length>8_500_000) {
      return Response.json({error:"حجم تصویر بیش از حد مجاز است."},{status:413});
    }

    const count = await reserveDailyAnalysis();
    if (count === -1) {
      return Response.json({error:"سهمیه امروز تمام شده است؛ روزانه حداکثر ۳ تحلیل مجاز است.",remaining:0},{status:429});
    }
    reserved = true;

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{
        Authorization:`Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
        messages:[
          {role:"system",content:instructions},
          {role:"user",content:[
            {type:"text",text:`نماد واردشده توسط کاربر: ${symbol||"نامشخص"}؛ تایم‌فریم انتخابی: ${timeframe}. تصویر را با قواعد بالا بررسی کن. اگر شواهد کافی نیست فقط WAIT بده. فقط JSON معتبر برگردان.`},
            {type:"image_url",image_url:{url:imageData}}
          ]}
        ],
        response_format:{type:"json_object"},
        temperature:0.1,
        max_completion_tokens:1600,
        stream:false
      })
    });

    const data = await upstream.json().catch(()=>({}));
    if(!upstream.ok) {
      await releaseDailyAnalysis();
      reserved = false;
      console.error("Groq error",upstream.status,data?.error?.message||data);
      const detail = upstream.status===429
        ? "سهمیه رایگان موقتاً پر شده است؛ کمی بعد دوباره تلاش کن. سهمیه سایت بازگردانده شد."
        : "موتور تحلیل پاسخ نداد؛ کلید Groq و وضعیت سرویس را بررسی کن. سهمیه این تلاش بازگردانده شد.";
      return Response.json({error:detail},{status:502});
    }

    const output = data?.choices?.[0]?.message?.content;
    if(typeof output!=="string" || !output.trim()) throw new Error("پاسخ خالی از موتور تحلیل.");
    let analysis;
    try {
      analysis=JSON.parse(output.trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,""));
    } catch {
      throw new Error("ساختار پاسخ تحلیل معتبر نبود؛ دوباره تلاش کن.");
    }

    if(!["LONG","SHORT","WAIT"].includes(analysis.decision)) analysis.decision="WAIT";
    if(!Array.isArray(analysis.targets)) analysis.targets=[];
    if(!Array.isArray(analysis.reasons)) analysis.reasons=[];
    if(!Array.isArray(analysis.visible_indicators)) analysis.visible_indicators=[];
    const confidence=Number(analysis.confidence);
    analysis.confidence=Number.isFinite(confidence)?Math.max(0,Math.min(100,Math.round(confidence))):0;
    if(analysis.confidence<70) analysis.decision="WAIT";
    if(analysis.decision==="WAIT") {
      analysis.entry="فعلاً ورود نکن";
      analysis.stop_loss="قابل تعیین نیست";
      analysis.targets=[];
      analysis.risk_reward="نامشخص";
    }
    analysis.symbol=analysis.symbol||symbol||"نامشخص";
    analysis.timeframe=analysis.timeframe||timeframe;
    analysis.chart_quality=analysis.chart_quality||"نامشخص";
    analysis.orientation=analysis.orientation||"نامشخص";
    return Response.json({analysis,remaining:Math.max(0,3-count)});
  } catch(e) {
    if(reserved) {
      try { await releaseDailyAnalysis(); }
      catch(releaseError) { console.error("Quota rollback error",releaseError); }
    }
    console.error("Analyze route error",e);
    return Response.json({
      error:e.message==="پاسخ خالی از موتور تحلیل."||e.message==="ساختار پاسخ تحلیل معتبر نبود؛ دوباره تلاش کن."
        ? e.message
        : "خطای داخلی سرور یا اتصال دیتابیس."
    },{status:500});
  }
}
