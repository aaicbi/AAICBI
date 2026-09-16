import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { isCoursePubliclyVisible } from "@/lib/courseStatus";
import { renderCurriculumPdf } from "@/lib/curriculumPdf";

/**
 * GET /api/courses/[id]/curriculum-pdf — publicly reachable, same
 * isCoursePubliclyVisible gate as GET /api/courses/public/[id] (this
 * is a marketing artifact, not enrolled-trainee content — a DRAFT/
 * UNPUBLISHED/ARCHIVED course 404s here exactly like everywhere else).
 * `runtime = "nodejs"` because @react-pdf/renderer needs Node APIs, not
 * the Edge runtime. `dynamic = "force-dynamic"` for the same reason the
 * two sibling public routes need it — see their own comments.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          select: {
            title: true,
            description: true,
            lessons: { orderBy: { order: "asc" }, select: { title: true, description: true } },
          },
        },
      },
    });
    if (!course || !isCoursePubliclyVisible(course.status)) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const pdfBuffer = await renderCurriculumPdf(course);
    const filename = `${course.title.replace(/[^\w\s.-]/g, "")}-outline.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
