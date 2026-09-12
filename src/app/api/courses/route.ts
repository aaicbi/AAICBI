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
  isFree: z.boolean().optional(),
  priceKobo: z.number().int().positive().nullable().optional(),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).nullable().optional(),
  accessModel: z.enum(["RECURRING_SUBSCRIPTION", "FIXED_DURATION"]).optional(),
  accessDurationValue: z.number().int().positive().nullable().optional(),
  accessDurationUnit: z.enum(["DAYS", "MONTHS", "LIFETIME"]).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysBeforeExpiry: z.array(z.number().int().positive()).optional(),
  comingSoon: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
  objectives: z.array(z.string()).optional(),
  prerequisites: z.string().nullable().optional(),
  benefits: z.array(z.string()).optional(),
  estimatedDuration: z.string().nullable().optional(),
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

    const pricingError = validateCoursePricing(parsed.data.isFree ?? true, parsed.data.priceKobo, parsed.data.billingInterval, {
      accessModel: parsed.data.accessModel,
      accessDurationValue: parsed.data.accessDurationValue,
      accessDurationUnit: parsed.data.accessDurationUnit,
      reminderEnabled: parsed.data.reminderEnabled,
    });
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: { ...parsed.data, createdById: session.userId },
    });
    return NextResponse.json(course, { status: 201 });
  });
}
