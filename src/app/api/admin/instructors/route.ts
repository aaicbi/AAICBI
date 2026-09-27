import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/instructors — every staff account with role
 * INSTRUCTOR, the real management list the master spec's "Instructor
 * Management" page needs. Account CREATION itself is deliberately not
 * a new route here — POST /api/admin/staff already creates an
 * INSTRUCTOR account with exactly the setup-link-email pattern the
 * spec wants; this route is read-only, plus each instructor's latest
 * agreement status and how many courses they own.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");

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
