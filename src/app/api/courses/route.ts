import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { createdByFilter } from "@/lib/courseOwnership";
import { validateCoursePricing } from "@/lib/coursePricing";

const CreateCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  // Post-M15 milestone — defaults preserved from the schema itself
  // (isFree true) rather than re-declared here, so this route can
  // never drift from what an omitted value actually means at the
  // database level.
  isFree: z.boolean().optional(),
  priceKobo: z.number().int().positive().nullable().optional(),
  // M26 — same reasoning as priceKobo above.
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).nullable().optional(),
});

/**
 * GET /api/courses — staff: their own courses (admin course-builder list),
 * except SUPER_ADMIN, who sees every course regardless of who created it
 * — see createdByFilter's own comment for the full reasoning and why
 * this is deliberately narrower than an ownership bypass. Trainees use
 * GET /api/courses/published instead (see that route) — kept as a
 * separate endpoint rather than a query param on this one, so
 * "what a trainee can see" and "what an admin manages" never share a
 * code path that could accidentally leak an unpublished course if
 * someone's role check slips later.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const courses = await prisma.course.findMany({
      where: createdByFilter(session),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { modules: true } } },
    });
    return NextResponse.json(courses);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = CreateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const pricingError = validateCoursePricing(parsed.data.isFree ?? true, parsed.data.priceKobo, parsed.data.billingInterval);
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: { ...parsed.data, createdById: session.userId },
    });
    return NextResponse.json(course, { status: 201 });
  });
}
