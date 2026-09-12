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
        accessModel: true,
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
    // Course enrollment/subscription system — narrowed to
    // RECURRING_SUBSCRIPTION only. This guard's real original purpose
    // was preventing a stray manual pay from creating a duplicate,
    // parallel Paystack subscription for a course that already renews
    // itself automatically. A FIXED_DURATION course has no such
    // parallel-subscription risk (each payment is a one-time charge),
    // and blocking it here would break the entire "renew before your
    // access lapses" flow — accessRevokedAt stays null right up until
    // the moment access actually expires, so this guard would otherwise
    // refuse a completely legitimate early renewal.
    if (existing && existing.accessRevokedAt === null && course.accessModel === "RECURRING_SUBSCRIPTION") {
      return NextResponse.json({ error: "You already have access to this course." }, { status: 409 });
    }

    const { authorizationUrl, accessCode, reference } = await initializeCoursePayment(trainee, course);

    // Course enrollment/subscription system — the initiating half of the
    // Payment ledger; processConfirmedCharge upserts this same row by
    // `reference` on confirmation, so a missed write here is tolerated,
    // not required. Non-blocking: a trainee should still get redirected
    // to checkout even if this insert fails for some reason.
    await prisma.payment
      .create({
        data: { traineeId: trainee.id, courseId: course.id, reference, amountKobo: course.priceKobo! },
      })
      .catch((e) => console.error(`Failed to create pending Payment record for reference ${reference}:`, e));

    return NextResponse.json({ authorizationUrl, accessCode, reference, email: trainee.email, amountKobo: course.priceKobo });
  });
}
