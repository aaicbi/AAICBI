import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { getCourseLifecyclePhase } from "@/lib/courseLifecycle";

/**
 * GET /api/courses/public — genuinely anonymous, no session required.
 * Every PUBLISHED course, for the general public catalogue at
 * /courses (reached from the landing page's own "Browse Courses"
 * button — the actual gap this feature closes, see the plan's own
 * context). Deliberately distinct from courses/public-free (a narrow,
 * free-courses-only selector built specifically for the registration
 * form) — this is the real, general-purpose catalogue, richer fields,
 * every published course regardless of price.
 */
// Bug fix: this route takes no request param and never calls
// cookies()/headers() (deliberately — it's genuinely anonymous), which
// gave Next.js nothing to signal dynamic rendering with. Route Handlers
// like that are eligible for static optimization by default, meaning
// this could get cached at BUILD time and keep serving that frozen
// snapshot in production — confirmed as the actual cause of a real
// report: a course published well after the last deploy simply never
// appeared on the public catalogue. Forcing dynamic rendering means
// every request genuinely re-queries the database.
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const courses = await prisma.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        level: true,
        durationDisplay: true,
        trainingFormat: true,
        isFree: true,
        priceKobo: true,
        billingInterval: true,
        showFlyer: true,
        flyerUrl: true,
        // Coming Soon Courses — schedule fields, so the catalogue page
        // can partition into "Upcoming"/"Available" and the dedicated
        // /courses/upcoming page can list+sort every scheduled course,
        // both without a second round-trip.
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        locationType: true,
        venue: true,
        capacity: true,
        lifecyclePhaseOverride: true,
        _count: { select: { modules: true, courseEnrollments: true } },
      },
    });

    const result = courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      durationDisplay: c.durationDisplay,
      trainingFormat: c.trainingFormat,
      isFree: c.isFree,
      priceKobo: c.priceKobo,
      billingInterval: c.billingInterval,
      flyerUrl: c.showFlyer ? c.flyerUrl : null,
      moduleCount: c._count.modules,
      startDate: c.startDate,
      endDate: c.endDate,
      registrationDeadline: c.registrationDeadline,
      locationType: c.locationType,
      venue: c.venue,
      capacity: c.capacity,
      enrolledCount: c._count.courseEnrollments,
      lifecyclePhase: getCourseLifecyclePhase(c),
    }));

    return NextResponse.json(result);
  });
}
