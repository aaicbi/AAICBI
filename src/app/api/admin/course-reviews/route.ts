import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { createdByFilter } from "@/lib/courseOwnership";

/**
 * GET /api/admin/course-reviews — every review, most recent first,
 * with a flag for whether it's already been promoted to a public
 * testimonial. SUPER_ADMIN/ADMIN/INSTRUCTOR — course feedback is
 * genuinely useful to any staff member teaching, not restricted to
 * the platform-wide-decision roles the way employer/job-posting
 * approval is.
 *
 * Security audit finding — this had no scoping at all, so a plain
 * ADMIN/INSTRUCTOR session (including a training organization's own
 * shadow session) saw every course's reviews platform-wide. Unlike
 * employer/job-posting approval, reviews DO have a natural "my own
 * courses" scope via the review's own course.createdById — reused
 * createdByFilter (the same helper GET /api/admin/payments already
 * uses) instead of blocking the route outright, so a training org can
 * still legitimately see feedback on its own courses.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const ownerFilter = createdByFilter(session);
    const reviews = await prisma.courseReview.findMany({
      where: ownerFilter ? { course: ownerFilter } : undefined,
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
