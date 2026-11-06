import { createSessionToken, safePasswordEqual, sessionCookie } from "../../../lib/security";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { password } = await req.json();
    if (!process.env.SITE_PASSWORD || !process.env.SESSION_SECRET) {
      return Response.json({ error: "تنظیمات رمز ورود در سرور کامل نیست." }, { status: 503 });
    }
    if (!safePasswordEqual(password, process.env.SITE_PASSWORD)) {
      return Response.json({ error: "رمز عبور اشتباه است." }, { status: 401 });
    }
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", sessionCookie(createSessionToken()));
    return response;
  } catch {
    return Response.json({ error: "درخواست ورود معتبر نیست." }, { status: 400 });
  }
}
