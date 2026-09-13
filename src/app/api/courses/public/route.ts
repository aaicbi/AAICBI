import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

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
        _count: { select: { modules: true } },
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
    }));

    return NextResponse.json(result);
  });
}
