import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getModuleAssessmentStats } from "@/lib/performanceDashboard";

/** GET /api/courses/[id]/performance/modules?moduleId= — same
 * ownership pattern as the parent performance route. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { createdById: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const moduleId = req.nextUrl.searchParams.get("moduleId") ?? undefined;
    const modules = await getModuleAssessmentStats(params.id, moduleId);

    return NextResponse.json({ modules });
  });
}
