import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyAdminsOfPitchSubmitted } from "@/lib/pitchNotify";
import { PitchSchema } from "@/lib/pitchSchema";

/**
 * GET/POST /api/trainee/pitches — Pitch & Post, Phase 1's founder-side
 * CRUD. Creation (even as a DRAFT) is gated server-side by the same
 * eligibility check GET /api/trainee/pitch-eligibility exposes to the
 * UI — the "Submit a Pitch" button not being shown is a convenience,
 * not the actual boundary.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const pitches = await prisma.pitchSubmission.findMany({
      where: { traineeId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(pitches);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const eligibleCount = await prisma.certificate.count({ where: { traineeId: session.userId, revokedAt: null } });
    if (eligibleCount === 0) {
      return NextResponse.json(
        { error: "You'll need at least one certificate before you can submit a pitch." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = PitchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const submitting = parsed.data.submit === true;
    const created = await prisma.pitchSubmission.create({
      data: {
        traineeId: session.userId,
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
        status: submitting ? "SUBMITTED" : "DRAFT",
        submittedAt: submitting ? new Date() : null,
      },
    });

    if (submitting) {
      const trainee = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true } });
      await notifyAdminsOfPitchSubmitted(created.id, created.startupName, trainee?.name ?? "A trainee");
    }

    return NextResponse.json(created, { status: 201 });
  });
}
