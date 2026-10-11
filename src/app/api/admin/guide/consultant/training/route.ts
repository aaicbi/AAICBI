import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { guideActor } from "@/lib/guide/knowledge";
import { ConsultantError, realClient } from "@/lib/guide/consultant";
import { consultantGate, proposeTraining } from "@/lib/guide/consultantReport";
import { isFeatureKey } from "@/lib/guide/aiGuidanceCore";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** POST { feature, goal? } — Claude drafts a guidance note for one AI feature. It is only a proposal: saving goes through /api/admin/guide/ai-guidance by a super admin. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ feature: z.string(), goal: z.string().trim().max(600).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success || !isFeatureKey(parsed.data.feature)) return NextResponse.json({ error: "Choose an AI feature." }, { status: 400 });
    const refused = await consultantGate(actor.userId);
    if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });
    try {
      const row = await proposeTraining(realClient(), actor.userId, parsed.data.feature, parsed.data.goal ?? "");
      return NextResponse.json({ id: row.id });
    } catch (e) {
      if (e instanceof ConsultantError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
