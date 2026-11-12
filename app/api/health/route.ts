import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const provider = getAIProvider();
  const names = [provider === "openrouter" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY", provider === "openrouter" ? "OPENROUTER_MODEL" : "GEMINI_MODEL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"];
  const settings = Object.fromEntries(names.map(n => [n, Boolean(process.env[n]?.trim())]));
  return NextResponse.json({ ok: Object.values(settings).every(Boolean), provider, settings }, { headers: { "Cache-Control": "no-store" } });
}
