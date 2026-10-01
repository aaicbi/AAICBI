import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineeInterestProfile } from "@/lib/analytics/interestScoring";

/**
 * GET /api/admin/trainees/[id]/interests — Analytics System Phase 3.
 * A single trainee's Interest Intelligence profile, for the admin
 * trainee-detail page. Same role gate as /api/admin/trainees/[id]
 * itself.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");

    const trainee = await prisma.trainee.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    const profile = await getTraineeInterestProfile(params.id);
    return NextResponse.json(profile);
  });
}
