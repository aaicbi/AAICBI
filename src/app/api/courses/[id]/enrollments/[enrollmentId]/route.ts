import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * PATCH /api/courses/[id]/enrollments/[enrollmentId] — revoke a
 * trainee's access to a course. A genuine, real gap closed here:
 * `CourseEnrollment.accessRevokedAt` has existed since M16 and is
 * checked everywhere access matters (`courseAccess.ts`,
 * `earlyWarning.ts`, `deletionGuards.ts`) — but nothing anywhere in
 * this app had ever actually SET it, confirmed directly by searching
 * every write site before building this. A soft revoke, not a hard
 * delete — same "never destroy real data, mark it instead" discipline
 * already used for certificates (`revokedAt`) elsewhere in this
 * project, preserving who enrolled them, when, and now that access was
 * later revoked, rather than erasing that history.
 */
export async function PATCH(_req: NextRequest, { params }: { params: { id: string; enrollmentId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const enrollment = await prisma.courseEnrollment.findUnique({ where: { id: params.enrollmentId } });
    if (!enrollment || enrollment.courseId !== params.id) {
      return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
    }
    if (enrollment.accessRevokedAt) {
      return NextResponse.json(enrollment); // already revoked — idempotent, not an error
    }

    const revoked = await prisma.courseEnrollment.update({
      where: { id: params.enrollmentId },
      data: { accessRevokedAt: new Date() },
      include: { trainee: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(revoked);
  });
}
