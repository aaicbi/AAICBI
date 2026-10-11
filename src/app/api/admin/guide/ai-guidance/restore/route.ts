import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { GuidanceError, restoreGuidance } from "@/lib/guide/aiGuidance";
import { guideActor } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/** POST /api/admin/guide/ai-guidance/restore — a super admin brings an older version back as a new version. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ feature: z.string().min(1).max(60), version: z.number().int().min(1) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a version." }, { status: 400 });
    try {
      return NextResponse.json({ ok: true, version: await restoreGuidance(parsed.data.feature, parsed.data.version, actor) });
    } catch (e) {
      if (e instanceof GuidanceError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
