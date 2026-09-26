import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/investor/pitches — every PUBLISHED pitch, teaser fields
 * only. No "Founder Readiness" panel (Phase 2 material — no real
 * distinction/percentile data exists yet, see the Phase 1 plan). Each
 * row also reports this investor's own disclosure state for it, so the
 * UI can show "Request Full Pitch" vs "Full pitch unlocked" without a
 * second round trip.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");

    const pitches = await prisma.pitchSubmission.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        startupName: true,
        industry: true,
        stage: true,
        problem: true,
        fundingType: true,
        fundingAmountKobo: true,
        disclosures: { where: { investorId: session.userId }, select: { status: true } },
      },
    });

    return NextResponse.json(
      pitches.map((p) => ({
        id: p.id,
        startupName: p.startupName,
        industry: p.industry,
        stage: p.stage,
        problemExcerpt: p.problem ? p.problem.slice(0, 160) : null,
        fundingType: p.fundingType,
        fundingAmountKobo: p.fundingAmountKobo,
        disclosureStatus: p.disclosures[0]?.status ?? null,
      }))
    );
  });
}
