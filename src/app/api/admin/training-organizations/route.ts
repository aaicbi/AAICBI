import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { countActiveTrainingOrgTrainees } from "@/lib/trainingOrgSeatCap";

/**
 * GET /api/admin/training-organizations — Training Organizations,
 * Phase 1. Same shape as GET /api/admin/employers: SUPER_ADMIN/ADMIN
 * only, a genuinely platform-wide trust decision, not scoped to any
 * one course.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const orgs = await prisma.trainingOrganization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { name: true } },
        certificateTemplates: { select: { id: true, name: true, approvedAt: true } },
      },
    });

    // Direct platform-fee billing — the seat-cap usage display ("12 /
    // 50 trainees") on the admin page; only meaningful for an approved
    // DIRECT_PAYMENT organization with a cap actually set, so every
    // other row skips the extra query entirely.
    const withSeatUsage = await Promise.all(
      orgs.map(async (org: (typeof orgs)[number]) => ({
        ...org,
        activeTraineeCount:
          org.staffUserId && org.billingModel === "DIRECT_PAYMENT" && org.trainingSeatCap
            ? await countActiveTrainingOrgTrainees(org.staffUserId)
            : null,
      }))
    );
    return NextResponse.json(withSeatUsage);
  });
}
