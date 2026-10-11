import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { NOT_TRAINABLE, NOTE_MAX } from "@/lib/guide/aiGuidanceCore";
import { GuidanceError, listGuidance, saveGuidance } from "@/lib/guide/aiGuidance";
import { guideActor } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/** GET /api/admin/guide/ai-guidance — SUPER_ADMIN reads the AI features that can be trained, each one's current guidance and its history. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json({ features: await listGuidance(), notTrainable: NOT_TRAINABLE, noteMax: NOTE_MAX });
  });
}

const Body = z.object({
  feature: z.string().min(1).max(60),
  note: z.string().max(5000),
  enabled: z.boolean().default(true),
  changeNote: z.string().trim().max(200).optional(),
  /** The consultant's proposal this came from, marked approved once a person has saved it. */
  suggestionId: z.string().min(1).max(40).optional(),
});

/**
 * POST /api/admin/guide/ai-guidance — a super admin saves guidance for an AI
 * feature as its next version (or switches it off, which also saves a
 * version). Only a person can do this: the consultant has no route here. The
 * note is checked: it may refine tone and context, never override rules.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the guidance and try again." }, { status: 400 });
    try {
      const version = await saveGuidance(parsed.data, actor);
      if (parsed.data.suggestionId) {
        await prisma.guideSuggestion.updateMany({ where: { id: parsed.data.suggestionId, status: "PENDING" }, data: { status: "APPROVED", decidedAt: new Date(), decidedById: actor.userId } });
      }
      return NextResponse.json({ ok: true, version }, { status: 201 });
    } catch (e) {
      if (e instanceof GuidanceError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
