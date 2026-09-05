import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * GET /api/courses/[id]/certificates — staff-only list of every
 * certificate issued for a course, for the "give both trainees and
 * admins visibility" pattern this project has followed since M13's
 * performance summaries. Ownership-checked like every other
 * course-scoped staff route.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const certificates = await prisma.certificate.findMany({
      where: { courseId: params.id },
      select: {
        id: true,
        code: true,
        issuedAt: true,
        revokedAt: true,
        trainee: { select: { name: true, email: true } },
      },
      orderBy: { issuedAt: "desc" },
    });

    return NextResponse.json({ certificates });
  });
}
