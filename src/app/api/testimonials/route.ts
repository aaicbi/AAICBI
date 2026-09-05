import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/testimonials — public, no authentication, only ever
 * returns published testimonials. The one route in this whole feature
 * anyone can reach without logging in — everything staff sees stays
 * behind the admin routes above.
 */
export async function GET() {
  return withApiErrors(async () => {
    const testimonials = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, traineeName: true, quote: true, rating: true, courseTitle: true },
    });
    return NextResponse.json(testimonials);
  });
}
