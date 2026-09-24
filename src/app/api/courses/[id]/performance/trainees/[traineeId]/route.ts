import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineePerformanceDetail } from "@/lib/performanceDashboard";

/** GET /api/courses/[id]/performance/trainees/[traineeId] — the
 * drill-down panel's data. Same ownership pattern as the parent
 * performance route, plus a check (inside getTraineePerformanceDetail)
 * that this trainee is actually enrolled in this course — same
 * "don't confirm existence" 404 convention either way. */
export async function GET(_req: Request, { params }: { params: { id: string; traineeId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { createdById: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const detail = await getTraineePerformanceDetail(params.id, params.traineeId);
    if (!detail) {
      return NextResponse.json({ error: "Trainee not found in this course." }, { status: 404 });
    }

    return NextResponse.json(detail);
  });
}
