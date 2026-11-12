import "server-only";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "./auth";
import { ClinicError, publicError } from "./errors";

export async function requireSession(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1);
  if (!await isValidSession(cookie)) throw new ClinicError("Please sign in to CareSlot.", 401);
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    // Next may normalize request.url to localhost behind a proxy. Host retains
    // the browser's actual origin (including its port); do not trust a client-
    // supplied patient identity or arbitrary forwarded-host header.
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host") ?? requestUrl.host;
    if (origin) {
      let parsed: URL;
      try { parsed = new URL(origin); } catch { throw new ClinicError("Invalid request origin.", 403); }
      if (parsed.host !== host || parsed.protocol !== requestUrl.protocol) throw new ClinicError("This request must come from CareSlot.", 403);
    }
  }
}
export async function api(request: Request, action: () => Promise<unknown>) {
  try {
    await requireSession(request);
    return NextResponse.json(await action(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const safe = publicError(error);
    return NextResponse.json({ error: safe.error }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
export function queryObject(request: Request) {
  const params = new URL(request.url).searchParams;
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in result) throw new ClinicError("Repeated query parameters are not supported.");
    result[key] = value;
  }
  return result;
}
export function validate<T>(result: { success: true; data: T } | { success: false }): T {
  if (!result.success) throw new ClinicError("Invalid request parameters.", 400);
  return result.data;
}
