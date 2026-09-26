import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/pitches — the Pitch Review Center's queue + summary
 * tiles, same card-plus-table shape as the existing Exam Results page.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const [pending, needsRevision, approved, published, pitches] = await Promise.all([
      prisma.pitchSubmission.count({ where: { status: "SUBMITTED" } }),
      prisma.pitchSubmission.count({ where: { status: "NEEDS_REVISION" } }),
      prisma.pitchSubmission.count({ where: { status: "APPROVED" } }),
      prisma.pitchSubmission.count({ where: { status: "PUBLISHED" } }),
      prisma.pitchSubmission.findMany({
        where: { status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        include: { trainee: { select: { name: true, email: true } }, cohort: { select: { id: true, name: true } } },
      }),
    ]);

    const investorInterest = await prisma.pitchDisclosure.count({ where: { interestedAt: { not: null } } });

    return NextResponse.json({
      summary: { pending, needsRevision, approved, published, investorInterest },
      pitches,
    });
  });
}
