import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { initializeCoursePayment } from "@/lib/paystack/subscription";

/**
 * POST /api/courses/[id]/pay — the paid counterpart to
 * POST /api/courses/[id]/enroll (which only ever works for free
 * courses). Genuinely different reasoning on re-payment after a
 * revoked enrollment, worth stating explicitly: the free-enroll route
 * refuses to silently undo a staff revocation, but a paid course's
 * revocation (see M27) most plausibly happened because a renewal
 * failed — a trainee paying again to restore their own lapsed
 * subscription is the expected, normal recovery path for a paid
 * product, not a bypass of anything a human deliberately decided.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { id: true, email: true },
    });

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        published: true,
        isFree: true,
        priceKobo: true,
        billingInterval: true,
        paystackPlanCode: true,
      },
    });
    if (!course || !course.published) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (course.isFree) {
      return NextResponse.json({ error: "This course is free — use the Enroll button instead." }, { status: 400 });
    }

    const existing = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: trainee.id, courseId: course.id } },
    });
    if (existing && existing.accessRevokedAt === null) {
      return NextResponse.json({ error: "You already have access to this course." }, { status: 409 });
    }

    const { authorizationUrl } = await initializeCoursePayment(trainee, course);
    return NextResponse.json({ authorizationUrl });
  });
}
