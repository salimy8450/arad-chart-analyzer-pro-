import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "arad_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  return process.env.SESSION_SECRET || "";
}

export function createSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(request) {
  if (!secret()) return false;
  const cookieHeader = request.headers.get("cookie") || "";
  const item = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + "="));
  if (!item) return false;
  const token = decodeURIComponent(item.slice(COOKIE_NAME.length + 1));
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", secret()).update(expires).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function safePasswordEqual(input, expected) {
  if (typeof input !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tehranDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("تنظیمات دیتابیس کامل نیست.");
  return { url: url.replace(/\/$/, ""), token };
}

export async function getDailyCount() {
  const { url, token } = redisConfig();
  const key = `arad:daily:${tehranDateKey()}`;
  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("ارتباط با دیتابیس برقرار نشد.");
  return Number(data.result || 0);
}

export async function reserveDailyAnalysis() {
  const { url, token } = redisConfig();
  const key = `arad:daily:${tehranDateKey()}`;
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],172800) end; if n>tonumber(ARGV[1]) then redis.call('DECR',KEYS[1]); return -1 end; return n";
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["EVAL", script, 1, key, "3"]]),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || data?.[0]?.error) throw new Error("ارتباط با دیتابیس برقرار نشد.");
  return Number(data?.[0]?.result);
}

export async function releaseDailyAnalysis() {
  const { url, token } = redisConfig();
  const key = `arad:daily:${tehranDateKey()}`;
  const response = await fetch(`${url}/decr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("بازگرداندن سهمیه ناموفق بود.");
}
