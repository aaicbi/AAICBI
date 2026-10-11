import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { guideActor } from "@/lib/guide/knowledge";
import { ConsultantError, realClient } from "@/lib/guide/consultant";
import { consultantGate, platformReport } from "@/lib/guide/consultantReport";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/admin/guide/consultant/report — SUPER_ADMIN asks Claude for a report on analytics, lesson materials, assessments and performance. Stored as a suggestion; changes nothing. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ days: z.number().int().min(7).max(90).optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const refused = await consultantGate(actor.userId);
    if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });
    try {
      const row = await platformReport(realClient(), actor.userId, parsed.data.days ?? 30);
      return NextResponse.json({ id: row.id });
    } catch (e) {
      if (e instanceof ConsultantError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
