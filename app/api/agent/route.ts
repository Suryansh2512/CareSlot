import { NextResponse } from "next/server";
import { requireSession } from "@/lib/http";
import { agentRequestSchema } from "@/lib/schemas";
import { runAgent } from "@/lib/agent/runAgent";
import { ClinicError, publicAgentError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await requireSession(request);
    const parsed = agentRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ClinicError("Invalid chat request.", 400);
    const result = await runAgent(parsed.data.messages, parsed.data.confirmation);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = publicAgentError(error);
    // Never log provider request bodies, keys, patient reasons or raw SDK errors.
    console.error("[agent]", safe.status === 429 ? "quota" : "request_failed");
    return NextResponse.json({ error: safe.error }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
