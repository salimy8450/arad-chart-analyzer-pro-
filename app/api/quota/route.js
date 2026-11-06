import { verifySession, getDailyCount } from "../../../lib/security";

export const runtime = "nodejs";

export async function GET(req) {
  if (!verifySession(req)) return Response.json({ error: "ابتدا وارد شو." }, { status: 401 });
  try {
    const used = await getDailyCount();
    return Response.json({ used, remaining: Math.max(0, 3 - used) });
  } catch (error) {
    console.error("Quota read error", error);
    return Response.json({ error: "خواندن سهمیه ناموفق بود." }, { status: 503 });
  }
}
