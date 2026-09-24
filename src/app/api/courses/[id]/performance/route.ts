import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineePerformanceRows, getPerformanceKpis } from "@/lib/performanceDashboard";

/**
 * GET /api/courses/[id]/performance?cohortId=&moduleId=
 *
 * Same ownership pattern as GET /api/courses/[id]/early-warnings:
 * ADMIN/INSTRUCTOR only see their own courses, SUPER_ADMIN sees any —
 * a visibility-only GET, not a mutation, so no requireOwnedCourse
 * (which has no SUPER_ADMIN bypass by design).
 */
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

    const cohortId = req.nextUrl.searchParams.get("cohortId") ?? undefined;
    const moduleId = req.nextUrl.searchParams.get("moduleId") ?? undefined;
    const filters = { cohortId, moduleId };

    const [kpis, rows, modules, cohorts] = await Promise.all([
      getPerformanceKpis(params.id, filters),
      getTraineePerformanceRows(params.id, filters),
      prisma.module.findMany({ where: { courseId: params.id }, orderBy: { order: "asc" }, select: { id: true, title: true, order: true } }),
      prisma.cohort.findMany({ where: { courseId: params.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    ]);

    return NextResponse.json({ kpis, rows, modules, cohorts });
  });
}
