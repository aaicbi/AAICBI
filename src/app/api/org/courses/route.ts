import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/org/courses — Training Organizations, Phase 1. The org's own
 * read-mostly course list: every course attributed to their shadow
 * staff account (see TrainingOrganization.staffUserId's own schema
 * comment), created by AAICBI staff on their behalf in this phase —
 * Phase 2 is what lets the org create these themselves.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINING_ORG");
    const org = await prisma.trainingOrganization.findUnique({
      where: { id: session.userId },
      select: { staffUserId: true },
    });
    if (!org?.staffUserId) {
      return NextResponse.json([]);
    }
    const courses = await prisma.course.findMany({
      where: { createdById: org.staffUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        certificateTemplateId: true,
        certificateTemplate: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(courses);
  });
}
