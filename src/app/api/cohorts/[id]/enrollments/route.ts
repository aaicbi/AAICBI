import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

const EnrollSchema = z.object({ email: z.string().email() });

/**
 * POST /api/cohorts/[id]/enrollments — enroll a trainee by email.
 * By email, not trainee id, because that's what a staff member
 * actually has on hand (a roster spreadsheet, a registration form) —
 * not an internal database id.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const cohort = await prisma.cohort.findUnique({ where: { id: params.id }, select: { courseId: true } });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
    }
    await requireOwnedCourse(cohort.courseId, session.userId);

    const body = await req.json();
    const parsed = EnrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
    if (!trainee) {
      return NextResponse.json({ error: "No trainee account found with that email." }, { status: 404 });
    }

    try {
      const enrollment = await prisma.enrollmentRecord.create({
        data: { cohortId: params.id, traineeId: trainee.id },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json(enrollment, { status: 201 });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "This trainee is already enrolled in this cohort." }, { status: 409 });
      }
      throw e;
    }
  });
}
