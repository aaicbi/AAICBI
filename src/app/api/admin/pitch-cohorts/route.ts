import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const CreateCohortSchema = z.object({
  name: z.string().trim().min(1).max(160),
  submissionDeadline: z.string().datetime().optional().or(z.literal("")),
});

/**
 * GET/POST /api/admin/pitch-cohorts — "Venture Track" batches. A new,
 * separate model from the course-scoped `Cohort` (see the schema's own
 * comment for why that one can't be reused here).
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const cohorts = await prisma.pitchCohort.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { pitches: true } } },
    });
    return NextResponse.json(cohorts);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = CreateCohortSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const created = await prisma.pitchCohort.create({
      data: {
        name: parsed.data.name,
        submissionDeadline: parsed.data.submissionDeadline ? new Date(parsed.data.submissionDeadline) : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  });
}
