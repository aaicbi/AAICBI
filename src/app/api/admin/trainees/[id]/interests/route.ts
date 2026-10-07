import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineeInterestProfile } from "@/lib/analytics/interestScoring";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/trainees/[id]/interests — Analytics System Phase 3.
 * A single trainee's Interest Intelligence profile, for the admin
 * trainee-detail page. Same role gate as /api/admin/trainees/[id]
 * itself — including the same security-audit training-org block.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    const profile = await getTraineeInterestProfile(params.id);
    return NextResponse.json(profile);
  });
}
