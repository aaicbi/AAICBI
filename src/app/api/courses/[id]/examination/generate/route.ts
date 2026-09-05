import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { generateCourseExamination } from "@/lib/ai/generateCourseExam";

/**
 * POST /api/courses/[id]/examination/generate — the "Generate Course
 * Examination" action. Ownership-checked like every other course-
 * scoped staff mutation, not just role-checked — an instructor can
 * trigger this for their own courses only, not anyone's.
 *
 * Genuinely slow (one Claude call per source question, sequential, plus
 * a second verification call for each) — this can take real time for a
 * course with a large combined module bank. The frontend triggering
 * this should show it as a background action, not something a staff
 * member waits on synchronously without feedback.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const result = await generateCourseExamination(params.id, session.userId);
    return NextResponse.json(result);
  });
}
