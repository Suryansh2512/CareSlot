import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (["/login", "/api/login", "/api/health"].includes(path)) return NextResponse.next();
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Please sign in to CareSlot." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
