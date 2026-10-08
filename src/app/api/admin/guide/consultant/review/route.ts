import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { guideActor } from "@/lib/guide/knowledge";
import { ConsultantError, consultantState, realClient, reviewQueue } from "@/lib/guide/consultant";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * POST /api/admin/guide/consultant/review — SUPER_ADMIN presses "Ask Claude
 * to review the waiting questions" (or "Ask Claude for a draft" on one).
 * Claude's proposals are stored as suggestions and used by nobody until the
 * super admin reviews and saves them. Refused when the consultant is off or
 * not configured; limited to 10 runs an hour.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ questionIds: z.array(z.string().min(1)).max(12).optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const state = await consultantState();
    if (state.availability === "off") return NextResponse.json({ error: "The Claude consultant is switched off. Switch it on first." }, { status: 403 });
    if (state.availability === "not_configured") return NextResponse.json({ error: "No Anthropic key is set up for this platform (ANTHROPIC_API_KEY), so the consultant cannot run." }, { status: 503 });
    const limit = await rateLimit(`guide-consultant:${actor.userId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "That is enough for now: the consultant can be asked 10 times an hour." }, { status: 429 });
    try {
      return NextResponse.json(await reviewQueue(realClient(), actor.userId, parsed.data.questionIds));
    } catch (e) {
      if (e instanceof ConsultantError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
