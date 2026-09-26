import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyFounderOfDisclosureRequest } from "@/lib/pitchNotify";

const RequestSchema = z.object({
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * POST /api/investor/pitches/[id]/request-disclosure — "Request Full
 * Pitch." Mirrors IntroductionRequest's @@unique-backed one-request-
 * per-pair behavior: a second request while one already exists is a
 * 409, not a duplicate row.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");

    const pitch = await prisma.pitchSubmission.findUnique({ where: { id: params.id } });
    if (!pitch || pitch.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }

    const existing = await prisma.pitchDisclosure.findUnique({
      where: { pitchSubmissionId_investorId: { pitchSubmissionId: params.id, investorId: session.userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "You've already requested this pitch's full materials." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const investor = await prisma.investor.findUnique({ where: { id: session.userId }, select: { organization: true } });

    const created = await prisma.pitchDisclosure.create({
      data: {
        pitchSubmissionId: params.id,
        investorId: session.userId,
        requestMessage: parsed.data.message || null,
      },
    });

    await notifyFounderOfDisclosureRequest(pitch.id, pitch.traineeId, pitch.startupName, investor?.organization ?? "An investor");

    return NextResponse.json(created, { status: 201 });
  });
}
