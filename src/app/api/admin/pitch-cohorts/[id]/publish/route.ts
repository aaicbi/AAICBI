import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyFounderOfPublish } from "@/lib/pitchNotify";

/**
 * POST /api/admin/pitch-cohorts/[id]/publish — "Demo Day": bulk-flips
 * every APPROVED pitch in this cohort to PUBLISHED and notifies each
 * founder. Idempotent-ish in spirit — only ever touches APPROVED rows,
 * so calling it again after new pitches are approved into an
 * already-published cohort just publishes those new ones too, rather
 * than erroring or double-notifying pitches already PUBLISHED.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const cohort = await prisma.pitchCohort.findUnique({ where: { id: params.id } });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
    }

    const toPublish = await prisma.pitchSubmission.findMany({
      where: { cohortId: params.id, status: "APPROVED" },
      select: { id: true, traineeId: true, startupName: true },
    });

    await prisma.$transaction([
      prisma.pitchSubmission.updateMany({
        where: { cohortId: params.id, status: "APPROVED" },
        data: { status: "PUBLISHED" },
      }),
      prisma.pitchCohort.update({ where: { id: params.id }, data: { publishedAt: cohort.publishedAt ?? new Date() } }),
    ]);

    for (const p of toPublish) {
      await notifyFounderOfPublish(p.id, p.traineeId, p.startupName);
    }

    return NextResponse.json({ ok: true, published: toPublish.length });
  });
}
