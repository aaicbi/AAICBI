import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam } from "@/lib/courseOwnership";

const BodySchema = z.object({ traineeId: z.string().min(1) });

/**
 * POST /api/exams/[id]/cooldown-override — the grant side of M22's
 * retake cooldown, which previously only had a read path
 * (nextAttemptAllowedAt in cooldownCore.ts already checks for a
 * CooldownOverride, but nothing ever created one). Upsert, not create:
 * CooldownOverride is unique on (traineeId, examId) by design, and
 * cooldownCore.ts's own comment explains why re-granting is exactly
 * right rather than an error — an override only counts if its
 * grantedAt is AFTER the attempt that triggered the current cooldown,
 * so refreshing grantedAt to now() is what makes a second grant bypass
 * a NEW cooldown the trainee has since re-entered, with no need to
 * "consume" or delete the row in between.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedExam(params.id, session.userId);

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A traineeId is required." }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { id: parsed.data.traineeId }, select: { id: true } });
    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    const override = await prisma.cooldownOverride.upsert({
      where: { traineeId_examId: { traineeId: parsed.data.traineeId, examId: params.id } },
      create: { traineeId: parsed.data.traineeId, examId: params.id, grantedById: session.userId },
      update: { grantedById: session.userId, grantedAt: new Date() },
    });

    return NextResponse.json({ id: override.id, grantedAt: override.grantedAt });
  });
}
