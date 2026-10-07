import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/instructors — every staff account with role
 * INSTRUCTOR, the real management list the master spec's "Instructor
 * Management" page needs. Account CREATION itself is deliberately not
 * a new route here — POST /api/admin/staff already creates an
 * INSTRUCTOR account with exactly the setup-link-email pattern the
 * spec wants; this route is read-only, plus each instructor's latest
 * agreement status and how many courses they own.
 *
 * Security audit finding — this was returning the full real-AAICBI-
 * instructor roster (name, email, course count, agreement status) to
 * any plain "ADMIN" session, including a training organization's own
 * shadow staff account. Instructor management has no training-org
 * concept at all (confirmed: no org field on User, no "Instructors"
 * link in ADMIN_NAV_TRAINING_ORG) — a training-org session is blocked
 * outright here, and on every other /api/admin/instructors/** route,
 * same defense-in-depth 404 pattern as GET /api/admin/trainees.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const instructors = await prisma.user.findMany({
      where: { role: "INSTRUCTOR" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        _count: { select: { courses: true } },
        instructorAgreementsOwned: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, sentAt: true, acceptedAt: true },
        },
      },
    });

    return NextResponse.json(
      instructors.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        active: i.active,
        createdAt: i.createdAt,
        courseCount: i._count.courses,
        latestAgreement: i.instructorAgreementsOwned[0] ?? null,
      }))
    );
  });
}
