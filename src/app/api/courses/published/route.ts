import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/courses/published — every published course, for a logged-in
 * trainee to browse. Deliberately not filtered by enrollment — M10
 * scope is "any trainee can view any published course," see the schema
 * comment on the Course/Module/Lesson/Material block for why real
 * enrollment logic is out of scope until later.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const courses = await prisma.course.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { modules: true } },
        courseEnrollments: {
          where: { traineeId: session.userId },
          select: { source: true, unlockedAt: true, accessRevokedAt: true, completedAt: true },
        },
      },
    });

    const result = courses.map((c) => {
      const enrollment = c.courseEnrollments[0] ?? null;
      const isPaid = enrollment?.source === "PAID" || !c.isFree;
      const isEnrolled = !!enrollment && !!enrollment.unlockedAt && !enrollment.accessRevokedAt;
      const isExpired = !!enrollment?.accessRevokedAt;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        isFree: c.isFree,
        priceKobo: c.priceKobo,
        billingInterval: c.billingInterval,
        _count: c._count,
        isPaid,
        isEnrolled,
        isExpired,
      };
    });

    return NextResponse.json(result);
  });
}
