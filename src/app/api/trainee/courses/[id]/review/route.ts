import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).optional(),
});

/**
 * GET/POST /api/trainee/courses/[id]/review — a trainee can only
 * review a course they've genuinely completed. Reuses `Certificate`
 * as the completion signal rather than inventing a separate one —
 * this project already moved certificate issuance specifically to
 * "passed the course examination" (M23), and a revoked certificate
 * correctly blocks a review the same way it already blocks
 * discoverability and disclosure elsewhere (M32, M33) — the
 * completion no longer genuinely stands.
 *
 * POST is an upsert, not create-only — a trainee revising their own
 * review later is a real, expected case for any review system, the
 * same "allow reconsidering" reasoning already applied to several
 * decisions elsewhere in this project, just here for the trainee's
 * own opinion rather than a staff decision.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const review = await prisma.courseReview.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: params.id } },
    });
    return NextResponse.json(review);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const certificate = await prisma.certificate.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: params.id } },
    });
    if (!certificate || certificate.revokedAt) {
      return NextResponse.json(
        { error: "You can only review a course after genuinely completing it." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const review = await prisma.courseReview.upsert({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: params.id } },
      create: {
        traineeId: session.userId,
        courseId: params.id,
        rating: parsed.data.rating,
        reviewText: parsed.data.reviewText || null,
      },
      update: {
        rating: parsed.data.rating,
        reviewText: parsed.data.reviewText || null,
      },
    });
    return NextResponse.json(review);
  });
}
