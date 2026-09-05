import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const PromoteSchema = z.object({ quote: z.string().trim().min(1).optional() });

/**
 * POST /api/admin/course-reviews/[id]/promote — the actual connection
 * point between real trainee feedback and the public landing page:
 * one click turns a genuine review into a testimonial, rather than
 * staff retyping something from scratch. A review with no written
 * text can't be promoted — a testimonial needs a real quote, and a
 * bare star rating alone isn't one. `quote` is optional here
 * specifically so staff can lightly edit for length or clarity
 * without changing what the trainee actually said in substance —
 * defaults to the review's own text if not overridden. A review
 * already promoted can't be promoted again — the real unique
 * constraint on `Testimonial.courseReviewId` enforces this at the
 * database level, not just checked here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const review = await prisma.courseReview.findUnique({
      where: { id: params.id },
      include: { trainee: { select: { name: true } }, course: { select: { title: true } } },
    });
    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    if (!review.reviewText) {
      return NextResponse.json({ error: "This review has no written text to promote." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PromoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const testimonial = await prisma.testimonial.create({
        data: {
          courseReviewId: review.id,
          traineeName: review.trainee.name,
          quote: parsed.data.quote || review.reviewText,
          rating: review.rating,
          courseTitle: review.course.title,
          createdById: session.userId,
        },
      });
      return NextResponse.json(testimonial, { status: 201 });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "This review has already been promoted." }, { status: 409 });
      }
      throw e;
    }
  });
}
