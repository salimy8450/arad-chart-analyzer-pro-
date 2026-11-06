import { verifySession, getDailyCount } from "../../../lib/security";

export const runtime = "nodejs";

export async function GET(req) {
  if (!verifySession(req)) return Response.json({ authenticated: false }, { status: 401 });
  try {
    const used = await getDailyCount();
    return Response.json({ authenticated: true, used, remaining: Math.max(0, 3 - used) });
  } catch (error) {
    console.error("Quota status error", error);
    return Response.json({ error: "وضعیت سهمیه از دیتابیس خوانده نشد." }, { status: 503 });
  }
}
