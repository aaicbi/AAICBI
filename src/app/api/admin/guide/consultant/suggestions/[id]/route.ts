import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { guideActor } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/guide/consultant/suggestions/[id] — SUPER_ADMIN records a
 * decision on a proposal: "approve" (after the human saved the answer or
 * action through the normal form) or "dismiss". This only marks the proposal;
 * it never writes an answer.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ action: z.enum(["approve", "dismiss"]) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const res = await prisma.guideSuggestion.updateMany({
      where: { id: params.id, status: "PENDING" },
      data: { status: parsed.data.action === "approve" ? "APPROVED" : "DISMISSED", decidedAt: new Date(), decidedById: actor.userId },
    });
    if (res.count === 0) return NextResponse.json({ error: "That proposal was already dealt with." }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
