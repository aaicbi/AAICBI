import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyAdminsOfPitchSubmitted } from "@/lib/pitchNotify";
import { PitchSchema } from "@/lib/pitchSchema";

async function findOwned(id: string, traineeId: string) {
  const row = await prisma.pitchSubmission.findUnique({ where: { id } });
  if (!row || row.traineeId !== traineeId) return null;
  return row;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const pitch = await findOwned(params.id, session.userId);
    if (!pitch) {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }
    return NextResponse.json(pitch);
  });
}

/**
 * PATCH /api/trainee/pitches/[id] — only editable while DRAFT or
 * NEEDS_REVISION. Re-submitting from NEEDS_REVISION moves the pitch
 * back to SUBMITTED and clears the prior rejection reason/note (they
 * described a version of the pitch that no longer exists) and
 * re-notifies admins exactly like a first submission.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await findOwned(params.id, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }
    if (existing.status !== "DRAFT" && existing.status !== "NEEDS_REVISION") {
      return NextResponse.json({ error: "This pitch can no longer be edited." }, { status: 409 });
    }

    const body = await req.json();
    const parsed = PitchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const submitting = parsed.data.submit === true;
    const wasNeedsRevision = existing.status === "NEEDS_REVISION";

    const updated = await prisma.pitchSubmission.update({
      where: { id: params.id },
      data: {
        startupName: parsed.data.startupName,
        industry: parsed.data.industry || null,
        problem: parsed.data.problem || null,
        solution: parsed.data.solution || null,
        targetMarket: parsed.data.targetMarket || null,
        businessModel: parsed.data.businessModel || null,
        stage: parsed.data.stage || null,
        traction: parsed.data.traction || null,
        teamDescription: parsed.data.teamDescription || null,
        pitchVideoUrl: parsed.data.pitchVideoUrl || null,
        pitchDeckUrl: parsed.data.pitchDeckUrl || null,
        demoUrl: parsed.data.demoUrl || null,
        githubUrl: parsed.data.githubUrl || null,
        fundingType: parsed.data.fundingType,
        fundingAmountKobo: parsed.data.fundingAmountKobo,
        minimumInvestmentKobo: parsed.data.minimumInvestmentKobo,
        fundingPurpose: parsed.data.fundingPurpose || null,
        status: submitting ? "SUBMITTED" : existing.status,
        submittedAt: submitting ? new Date() : existing.submittedAt,
        ...(submitting && wasNeedsRevision ? { rejectionReasonCategory: null, rejectionNote: null } : {}),
      },
    });

    if (submitting) {
      const trainee = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true } });
      await notifyAdminsOfPitchSubmitted(updated.id, updated.startupName, trainee?.name ?? "A trainee");
    }

    return NextResponse.json(updated);
  });
}
