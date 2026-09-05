import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const CreateSchema = z.object({
  traineeName: z.string().trim().min(1),
  quote: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  courseTitle: z.string().trim().optional(),
});

/**
 * GET/POST /api/admin/testimonials — every testimonial (published or
 * not), and manual creation for something genuine that predates this
 * system or never went through the review flow — a real, separate
 * path from promoting a review, not a workaround for one. Deliberately
 * not tied to a real Trainee record — the whole point of this path is
 * covering a testimonial staff heard about outside the platform.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const testimonials = await prisma.testimonial.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(testimonials);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const testimonial = await prisma.testimonial.create({
      data: {
        traineeName: parsed.data.traineeName,
        quote: parsed.data.quote,
        rating: parsed.data.rating,
        courseTitle: parsed.data.courseTitle,
        createdById: session.userId,
      },
    });
    return NextResponse.json(testimonial, { status: 201 });
  });
}
