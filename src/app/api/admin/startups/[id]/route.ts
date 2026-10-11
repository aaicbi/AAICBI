import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { decideStartup, setVerified } from "@/lib/startups/startups";
import { startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** POST { action: approve|reject|suspend|reinstate, note? } or { verified: boolean } — SUPER_ADMIN decides a startup. Rejecting and suspending need a reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = z.union([z.object({ action: z.enum(["approve", "reject", "suspend", "reinstate"]), note: z.string().max(1000).optional() }), z.object({ verified: z.boolean() })]).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      if ("verified" in parsed.data) await setVerified(params.id, parsed.data.verified);
      else await decideStartup(params.id, parsed.data.action, parsed.data.note?.trim() || null, { userId: session.userId });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}
