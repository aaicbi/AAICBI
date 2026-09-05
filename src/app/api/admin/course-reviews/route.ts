import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/course-reviews — every review, most recent first,
 * with a flag for whether it's already been promoted to a public
 * testimonial. SUPER_ADMIN/ADMIN/INSTRUCTOR — course feedback is
 * genuinely useful to any staff member teaching, not restricted to
 * the platform-wide-decision roles the way employer/job-posting
 * approval is.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const reviews = await prisma.courseReview.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        trainee: { select: { name: true } },
        course: { select: { title: true } },
        testimonial: { select: { id: true } },
      },
    });
    return NextResponse.json(
      reviews.map((r: (typeof reviews)[number]) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        traineeName: r.trainee.name,
        courseTitle: r.course.title,
        alreadyPromoted: r.testimonial !== null,
      }))
    );
  });
}
