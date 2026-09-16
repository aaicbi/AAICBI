import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { isCoursePubliclyVisible } from "@/lib/courseStatus";
import { isRegistrationOpen } from "@/lib/courseLifecycle";

/**
 * POST /api/courses/[id]/enroll — genuinely minimal, on purpose. Just
 * the FREE self-enroll path, the one real slice of M19 that has to
 * exist alongside M18: gating course content by enrollment and having
 * no way for anyone to actually become enrolled would lock every
 * trainee out of every course the moment M18 shipped, exactly the
 * failure mode the roadmap's own audit warned about. Admin-granted
 * enrollment and the full M19 UI remain separate, not-yet-built work.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        isFree: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        lifecyclePhaseOverride: true,
      },
    });
    if (!course || !isCoursePubliclyVisible(course.status)) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    // Coming Soon Courses — a course with no schedule fields set is
    // never blocked here (isRegistrationOpen returns true for phase
    // `null`), so every existing course behaves exactly as before.
    if (!isRegistrationOpen(course)) {
      return NextResponse.json({ error: "Registration for this course is not currently open." }, { status: 400 });
    }
    if (!course.isFree) {
      // Honest, not a workaround: paid enrollment doesn't exist yet
      // (that's M25–M29). Rejecting clearly here is better than a
      // confusing partial-success or a silent no-op.
      return NextResponse.json(
        { error: "This course requires payment, which isn't available to enroll in yet." },
        { status: 400 }
      );
    }

    const existing = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: params.id } },
    });
    if (existing) {
      if (existing.accessRevokedAt) {
        // A staff member deliberately revoked this at some point —
        // silently re-granting it here would undo that decision
        // without them ever being involved again.
        return NextResponse.json(
          { error: "Your access to this course was revoked. Contact a staff member if you believe this is a mistake." },
          { status: 403 }
        );
      }
      // Already enrolled — idempotent, not an error, so a trainee
      // clicking "Enroll" twice (a slow network, a double click)
      // doesn't see a confusing failure for something that already
      // succeeded.
      return NextResponse.json({ enrolled: true });
    }

    await prisma.courseEnrollment.create({
      data: { traineeId: session.userId, courseId: params.id, source: "FREE", unlockedAt: new Date() },
    });
    return NextResponse.json({ enrolled: true });
  });
}
