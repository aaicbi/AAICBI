import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedInvestor } from "@/lib/investorAccess";

/**
 * POST /api/investor/pitches/[id]/watchlist — toggles this pitch on
 * this investor's own "save for later" list. Genuinely independent of
 * PitchDisclosure (see PitchWatchlistItem's own schema comment): an
 * investor can watchlist a pitch they've never requested disclosure
 * on. Idempotent-by-toggle rather than separate save/unsave endpoints
 * — the client already knows its current watchlisted state from the
 * list/detail routes, so one endpoint flipping it is simpler than two.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");
    await requireApprovedInvestor(session.userId);

    const pitch = await prisma.pitchSubmission.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!pitch || pitch.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }

    const existing = await prisma.pitchWatchlistItem.findUnique({
      where: { investorId_pitchSubmissionId: { investorId: session.userId, pitchSubmissionId: params.id } },
    });

    if (existing) {
      await prisma.pitchWatchlistItem.delete({ where: { id: existing.id } });
      return NextResponse.json({ watchlisted: false });
    }

    await prisma.pitchWatchlistItem.create({
      data: { investorId: session.userId, pitchSubmissionId: params.id },
    });
    return NextResponse.json({ watchlisted: true });
  });
}
