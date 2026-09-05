import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * GET/POST /api/courses/[id]/cohorts — the whole-project audit
 * recommendation: intake/cohort tracking. See the schema comment on
 * Cohort for the full design reasoning, especially what this
 * deliberately does NOT solve (per-cohort progress reset).
 */
const CreateCohortSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const cohorts = await prisma.cohort.findMany({
      where: { courseId: params.id },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(cohorts);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const body = await req.json();
    const parsed = CreateCohortSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const cohort = await prisma.cohort.create({
      data: {
        courseId: params.id,
        name: parsed.data.name,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });
    return NextResponse.json(cohort, { status: 201 });
  });
}
