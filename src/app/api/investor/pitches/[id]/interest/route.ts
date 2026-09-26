import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyOfInterest } from "@/lib/pitchNotify";

const InterestSchema = z.object({
  message: z.string().trim().max(1000).optional().or(z.literal("")),
  investmentRangeKobo: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/investor/pitches/[id]/interest — "Express Interest." Only
 * ever reachable after this investor's disclosure has been ACCEPTED by
 * the founder — folded onto the same PitchDisclosure row rather than a
 * separate table (see that model's own schema comment).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");

    const disclosure = await prisma.pitchDisclosure.findUnique({
      where: { pitchSubmissionId_investorId: { pitchSubmissionId: params.id, investorId: session.userId } },
      include: { pitch: { select: { id: true, traineeId: true, startupName: true } } },
    });
    if (!disclosure || disclosure.status !== "ACCEPTED") {
      return NextResponse.json({ error: "You can express interest once the founder has shared the full pitch with you." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = InterestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const investor = await prisma.investor.findUnique({ where: { id: session.userId }, select: { organization: true } });

    const updated = await prisma.pitchDisclosure.update({
      where: { id: disclosure.id },
      data: {
        interestMessage: parsed.data.message || null,
        interestRangeKobo: parsed.data.investmentRangeKobo,
        interestedAt: new Date(),
      },
    });

    await notifyOfInterest(disclosure.pitch.id, disclosure.pitch.traineeId, disclosure.pitch.startupName, investor?.organization ?? "An investor");

    return NextResponse.json(updated);
  });
}
