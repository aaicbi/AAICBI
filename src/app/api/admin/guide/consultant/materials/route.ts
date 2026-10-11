import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { guideActor } from "@/lib/guide/knowledge";
import { ConsultantError, realClient } from "@/lib/guide/consultant";
import { consultantGate, materialChoices, reviewModuleMaterials } from "@/lib/guide/consultantReport";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET — the courses and modules a super admin can choose to have reviewed. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json({ courses: await materialChoices() });
  });
}

/** POST { moduleId } — Claude reviews the written lesson materials of one module. Advice only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ moduleId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a module first." }, { status: 400 });
    const refused = await consultantGate(actor.userId);
    if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });
    try {
      const row = await reviewModuleMaterials(realClient(), actor.userId, parsed.data.moduleId);
      return NextResponse.json({ id: row.id });
    } catch (e) {
      if (e instanceof ConsultantError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
