import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/investor/pitches/[id] — teaser shape for everyone, full
 * materials shape only once this investor's own PitchDisclosure is
 * ACCEPTED, and only the specific fields the founder checked
 * (share*). The same 404-regardless-of-reason discipline this app
 * uses everywhere else: a non-published or non-existent pitch returns
 * the identical 404.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");

    const pitch = await prisma.pitchSubmission.findUnique({
      where: { id: params.id },
      include: { disclosures: { where: { investorId: session.userId } } },
    });
    if (!pitch || pitch.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }

    const disclosure = pitch.disclosures[0] ?? null;
    const unlocked = disclosure?.status === "ACCEPTED";

    // Only the teaser fields (problem, sector, stage, funding ask) are
    // ever public — solution/targetMarket/businessModel/traction and
    // every materials URL are the "full pitch" this investor's own
    // disclosure must be ACCEPTED to see, matching what the founder
    // actually agreed to share (share* flags) for the materials, and
    // gating the narrative fields on the same unlocked boolean.
    return NextResponse.json({
      id: pitch.id,
      startupName: pitch.startupName,
      industry: pitch.industry,
      stage: pitch.stage,
      problem: pitch.problem,
      fundingType: pitch.fundingType,
      fundingAmountKobo: pitch.fundingAmountKobo,
      minimumInvestmentKobo: pitch.minimumInvestmentKobo,
      disclosureStatus: disclosure?.status ?? null,
      interestedAt: disclosure?.interestedAt ?? null,
      solution: unlocked ? pitch.solution : null,
      targetMarket: unlocked ? pitch.targetMarket : null,
      businessModel: unlocked ? pitch.businessModel : null,
      traction: unlocked ? pitch.traction : null,
      pitchVideoUrl: unlocked && disclosure!.shareVideo ? pitch.pitchVideoUrl : null,
      pitchDeckUrl: unlocked && disclosure!.shareDeck ? pitch.pitchDeckUrl : null,
      demoUrl: unlocked && disclosure!.shareDemo ? pitch.demoUrl : null,
      githubUrl: unlocked && disclosure!.shareGithub ? pitch.githubUrl : null,
    });
  });
}
