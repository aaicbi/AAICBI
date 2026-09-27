import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getRevenueForPeriod, monthRange, computePayoutKobo } from "@/lib/paymentSummary";

/**
 * GET /api/instructor/payments/payout?month=YYYY-MM — the instructor's
 * own "My Payments" figure: no course-selection param, since scope is
 * implicitly every course this instructor owns (Course.createdById).
 * Defaults to the current calendar month when `month` is omitted.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("INSTRUCTOR");

    const monthParam = req.nextUrl.searchParams.get("month");
    const month = monthParam ?? new Date().toISOString().slice(0, 7);
    const range = monthRange(month);

    const courses = await prisma.course.findMany({
      where: { createdById: session.userId },
      select: {
        id: true,
        title: true,
        payoutType: true,
        payoutPercentage: true,
        payoutFlatRateKobo: true,
        payoutNotes: true,
        payoutUpdatedAt: true,
      },
    });

    const perCourse = await Promise.all(
      courses.map(async (course) => {
        const figure = await getRevenueForPeriod({ courseId: course.id }, range);
        return {
          courseId: course.id,
          courseTitle: course.title,
          payoutType: course.payoutType,
          payoutPercentage: course.payoutPercentage,
          payoutFlatRateKobo: course.payoutFlatRateKobo,
          payoutNotes: course.payoutNotes,
          payoutUpdatedAt: course.payoutUpdatedAt,
          revenueKobo: figure.revenueKobo,
          payerCount: figure.payerCount,
          entitlementKobo: computePayoutKobo(course, figure),
        };
      })
    );

    const totalEntitlementKobo = perCourse.reduce((sum, c) => sum + (c.entitlementKobo ?? 0), 0);

    return NextResponse.json({ month, courses: perCourse, totalEntitlementKobo });
  });
}
