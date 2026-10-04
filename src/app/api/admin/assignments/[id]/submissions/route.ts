import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";

/**
 * GET /api/admin/assignments/[id]/submissions — the instructor review
 * queue. Every attempt (resubmission history included), most recent
 * first — the review page splits this into "Needs Review" / "Decided"
 * client-side, same shape as every other admin review queue in this
 * app (employers, showcase).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: params.id },
      orderBy: [{ traineeId: "asc" }, { attemptNumber: "desc" }],
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        instructorReviewedBy: { select: { name: true } },
        _count: { select: { answers: true } },
      },
    });
    return NextResponse.json(submissions);
  });
}
