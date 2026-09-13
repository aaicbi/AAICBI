import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { isCoursePubliclyVisible } from "@/lib/courseStatus";
import { buildMarketingView } from "@/lib/courseMarketing";

/**
 * GET /api/courses/public/[id] — genuinely anonymous course detail,
 * the third consumer of buildMarketingView alongside the trainee
 * "not enrolled yet" branch and the staff preview route. Same
 * isCoursePubliclyVisible gate as every other route — a DRAFT/
 * UNPUBLISHED/ARCHIVED course 404s here exactly like it does
 * everywhere else, never revealed to an anonymous visitor.
 *
 * Deliberately session-agnostic: this route never checks who's
 * asking, or whether they're already enrolled — a page rendering this
 * response separately (best-effort, client-side) checks the real
 * authenticated GET /api/courses/[id] to decide whether to redirect an
 * already-enrolled trainee to their full course view instead.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
        },
      },
    });
    if (!course || !isCoursePubliclyVisible(course.status)) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    return NextResponse.json(buildMarketingView(course));
  });
}
