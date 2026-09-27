import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedInvestor } from "@/lib/investorAccess";
import { getFounderReadiness } from "@/lib/founderReadiness";

/**
 * GET /api/investor/pitches — every PUBLISHED pitch, teaser fields
 * only, plus the Founder Readiness signal (certificate + real exam
 * score/percentile — see founderReadiness.ts). Each row also reports
 * this investor's own disclosure state for it, so the UI can show
 * "Request Full Pitch" vs "Full pitch unlocked" without a second round
 * trip.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");
    await requireApprovedInvestor(session.userId);

    const pitches = await prisma.pitchSubmission.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        traineeId: true,
        startupName: true,
        industry: true,
        stage: true,
        problem: true,
        fundingType: true,
        fundingAmountKobo: true,
        teaserVideoUrl: true,
        projectedReturnSummary: true,
        publicImpactStatement: true,
        disclosures: { where: { investorId: session.userId }, select: { status: true } },
        watchlistedBy: { where: { investorId: session.userId }, select: { id: true } },
      },
    });

    return NextResponse.json(
      await Promise.all(
        pitches.map(async (p) => ({
          id: p.id,
          startupName: p.startupName,
          industry: p.industry,
          stage: p.stage,
          problemExcerpt: p.problem ? p.problem.slice(0, 160) : null,
          fundingType: p.fundingType,
          fundingAmountKobo: p.fundingAmountKobo,
          // Phase 2 public teaser — unconditional, unlike everything below
          // the disclosure gate in the detail route.
          teaserVideoUrl: p.teaserVideoUrl,
          projectedReturnSummary: p.projectedReturnSummary,
          publicImpactStatement: p.publicImpactStatement,
          founderReadiness: await getFounderReadiness(p.traineeId),
          disclosureStatus: p.disclosures[0]?.status ?? null,
          watchlisted: p.watchlistedBy.length > 0,
        }))
      )
    );
  });
}
