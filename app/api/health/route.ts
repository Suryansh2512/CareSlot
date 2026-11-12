import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const names = ["GEMINI_API_KEY", "GEMINI_MODEL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"];
  const settings = Object.fromEntries(names.map(n => [n, Boolean(process.env[n]?.trim())]));
  return NextResponse.json({ ok: Object.values(settings).every(Boolean), settings }, { headers: { "Cache-Control": "no-store" } });
}
