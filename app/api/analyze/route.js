import { verifySession, reserveDailyAnalysis, releaseDailyAnalysis } from "../../../lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const instructions = `تو تحلیل‌گر تکنیکال محتاط ARAD CHART ANALYZER PRO هستی. فقط شواهد قابل مشاهده در تصویر را تحلیل کن؛ به قیمت زنده دسترسی نداری. اندیکاتوری را که در تصویر دیده نمی‌شود فرض نکن. اگر محور قیمت یا ساختار نمودار واضح نیست، تصمیم WAIT بده و عدد نساز.
decision فقط LONG یا SHORT یا WAIT باشد. confidence از ۰ تا ۱۰۰ فقط وضوح شواهد تصویری است و احتمال موفقیت نیست. اگر confidence کمتر از ۶۵ است، تصمیم WAIT بده. Entry و SL و اهداف فقط وقتی تعیین شوند که مقیاس قیمت به‌وضوح قابل خواندن باشد. تارگت‌ها در جهت معامله و به ترتیب باشند. پاسخ فقط JSON معتبر با این کلیدها باشد:
{"decision":"WAIT","symbol":"نامشخص","timeframe":"نامشخص","confidence":0,"entry":"قابل تعیین نیست","stop_loss":"قابل تعیین نیست","targets":[],"risk_reward":"نامشخص","trend":"نامشخص","reasons":[],"invalidation":"نامشخص","caution":"این تحلیل آموزشی است و تضمین سود نیست."}
متن فارسی باشد؛ مقادیر decision انگلیسی بماند.`;

export async function POST(req) {
  if (!verifySession(req)) return Response.json({ error: "برای تحلیل ابتدا با رمز شخصی وارد شو." }, { status: 401 });
  let reserved = false;
  try {
    if (!process.env.OPENAI_API_KEY) return Response.json({error:"کلید OPENAI_API_KEY در تنظیمات سرور ثبت نشده است."},{status:503});
    const {imageData,symbol="",timeframe="15m"} = await req.json();
    if(typeof imageData!=="string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData)) return Response.json({error:"تصویر معتبر نیست."},{status:400});
    if(imageData.length>8_500_000) return Response.json({error:"حجم تصویر بیش از حد مجاز است."},{status:413});

    const count = await reserveDailyAnalysis();
    if (count === -1) return Response.json({error:"سهمیه امروز تمام شده است؛ روزانه حداکثر ۳ تحلیل مجاز است.",remaining:0},{status:429});
    reserved = true;

    const upstream=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions,input:[{role:"user",content:[{type:"input_text",text:`نماد: ${symbol||"نامشخص"}؛ تایم‌فریم انتخابی: ${timeframe}. چارت را بررسی کن.`},{type:"input_image",image_url:imageData,detail:"high"}]}],max_output_tokens:1100})
    });
    const data=await upstream.json();
    if(!upstream.ok){
      await releaseDailyAnalysis(); reserved = false;
      console.error("OpenAI error",data?.error?.message||upstream.status);
      return Response.json({error:"سرویس تحلیل در دسترس نیست؛ اعتبار API را بررسی کن. سهمیه این تلاش بازگردانده شد."},{status:502});
    }
    const output=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
    if(!output) throw new Error("پاسخ خالی از موتور تحلیل.");
    let analysis;
    try{analysis=JSON.parse(output.replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"").trim());}catch{throw new Error("ساختار پاسخ تحلیل معتبر نبود؛ دوباره تلاش کن.");}
    if(!["LONG","SHORT","WAIT"].includes(analysis.decision))analysis.decision="WAIT";
    if(!Array.isArray(analysis.targets))analysis.targets=[];
    if(!Array.isArray(analysis.reasons))analysis.reasons=[];
    if(analysis.decision==="WAIT"){analysis.entry="فعلاً ورود نکن";analysis.targets=[];}
    return Response.json({analysis,remaining:Math.max(0,3-count)});
  }catch(e){
    if (reserved) { try { await releaseDailyAnalysis(); } catch (releaseError) { console.error("Quota rollback error", releaseError); } }
    console.error(e);
    return Response.json({error:e.message==="پاسخ خالی از موتور تحلیل."||e.message==="ساختار پاسخ تحلیل معتبر نبود؛ دوباره تلاش کن."?e.message:"خطای داخلی سرور یا اتصال دیتابیس."},{status:500});
  }
}
