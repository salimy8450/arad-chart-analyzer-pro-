export const runtime = "nodejs";
export const maxDuration = 60;

const instructions = `تو تحلیل‌گر تکنیکال محتاط ARAD CHART ANALYZER PRO هستی. فقط شواهد قابل مشاهده در تصویر را تحلیل کن؛ به قیمت زنده دسترسی نداری. اندیکاتوری را که در تصویر دیده نمی‌شود فرض نکن. اگر محور قیمت یا ساختار نمودار واضح نیست، تصمیم WAIT بده و عدد نساز.
decision فقط LONG یا SHORT یا WAIT باشد. confidence از ۰ تا ۱۰۰ فقط وضوح شواهد تصویری است و احتمال موفقیت نیست. اگر confidence کمتر از ۶۵ است، تصمیم WAIT بده. Entry و SL و اهداف فقط وقتی تعیین شوند که مقیاس قیمت به‌وضوح قابل خواندن باشد. تارگت‌ها در جهت معامله و به ترتیب باشند. پاسخ فقط JSON معتبر با این کلیدها باشد:
{"decision":"WAIT","symbol":"نامشخص","timeframe":"نامشخص","confidence":0,"entry":"قابل تعیین نیست","stop_loss":"قابل تعیین نیست","targets":[],"risk_reward":"نامشخص","trend":"نامشخص","reasons":[],"invalidation":"نامشخص","caution":"این تحلیل آموزشی است و تضمین سود نیست."}
متن فارسی باشد؛ مقادیر decision انگلیسی بماند.`;

export async function POST(req) {
  try {
    if (!process.env.OPENAI_API_KEY) return Response.json({error:"کلید OPENAI_API_KEY در تنظیمات سرور ثبت نشده است."},{status:503});
    const {imageData,symbol="",timeframe="15m"} = await req.json();
    if(typeof imageData!=="string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData)) return Response.json({error:"تصویر معتبر نیست."},{status:400});
    if(imageData.length>8_500_000) return Response.json({error:"حجم تصویر بیش از حد مجاز است."},{status:413});
    const upstream=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",instructions,input:[{role:"user",content:[{type:"input_text",text:`نماد: ${symbol||"نامشخص"}؛ تایم‌فریم انتخابی: ${timeframe}. چارت را بررسی کن.`},{type:"input_image",image_url:imageData,detail:"high"}]}],max_output_tokens:1100})
    });
    const data=await upstream.json();
    if(!upstream.ok){console.error("OpenAI error",data?.error?.message||upstream.status);return Response.json({error:"سرویس تحلیل در دسترس نیست؛ کلید و اعتبار API را بررسی کن."},{status:502});}
    const output=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
    if(!output)return Response.json({error:"پاسخ خالی از موتور تحلیل."},{status:502});
    let analysis;
    try{analysis=JSON.parse(output.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim());}catch{return Response.json({error:"ساختار پاسخ تحلیل معتبر نبود؛ دوباره تلاش کن."},{status:502});}
    if(!["LONG","SHORT","WAIT"].includes(analysis.decision))analysis.decision="WAIT";
    if(!Array.isArray(analysis.targets))analysis.targets=[];
    if(!Array.isArray(analysis.reasons))analysis.reasons=[];
    if(analysis.decision==="WAIT"){analysis.entry="فعلاً ورود نکن";analysis.targets=[];}
    return Response.json({analysis});
  }catch(e){console.error(e);return Response.json({error:"خطای داخلی سرور."},{status:500});}
}