import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { buildMarketingView } from "@/lib/courseMarketing";

/**
 * GET /api/admin/courses/[id]/preview — "Preview as Trainee." The one
 * deliberate bypass point in this whole feature: calls
 * buildMarketingView WITHOUT the isCoursePubliclyVisible check every
 * other route enforces, so a DRAFT course can be previewed before it's
 * ever published. Isolated to this one staff-only route rather than a
 * query-param flag on the real trainee/public routes, so a bug here
 * can never leak draft content to an actual trainee.
 *
 * Same ownership broadening as GET /api/courses/[id]: SUPER_ADMIN can
 * preview any course; ADMIN/INSTRUCTOR only their own.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
        },
        // Coming Soon Courses — feeds buildMarketingView's enrolledCount.
        _count: { select: { courseEnrollments: true } },
      },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    const isOwner = session.role === "SUPER_ADMIN" || course.createdById === session.userId;
    if (!isOwner) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    return NextResponse.json(buildMarketingView(course));
  });
}
