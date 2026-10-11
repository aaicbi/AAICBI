import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { guideActor } from "@/lib/guide/knowledge";
import { ConsultantError, askConsultant, consultantState, realClient } from "@/lib/guide/consultant";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** POST /api/admin/guide/consultant/ask — SUPER_ADMIN asks the consultant for advice about Loop and what visitors struggle with. Advice only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ question: z.string().trim().min(3).max(1000) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Write your question first." }, { status: 400 });
    const state = await consultantState();
    if (state.availability === "off") return NextResponse.json({ error: "The Claude consultant is switched off. Switch it on first." }, { status: 403 });
    if (state.availability === "not_configured") return NextResponse.json({ error: "No Anthropic key is set up for this platform (ANTHROPIC_API_KEY), so the consultant cannot run." }, { status: 503 });
    const limit = await rateLimit(`guide-consultant:${actor.userId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "That is enough for now: the consultant can be asked 10 times an hour." }, { status: 429 });
    try {
      const row = await askConsultant(realClient(), actor.userId, parsed.data.question);
      return NextResponse.json({ id: row.id });
    } catch (e) {
      if (e instanceof ConsultantError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
