import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/training-organizations — Training Organizations,
 * Phase 1. Same shape as GET /api/admin/employers: SUPER_ADMIN/ADMIN
 * only, a genuinely platform-wide trust decision, not scoped to any
 * one course.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const orgs = await prisma.trainingOrganization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { name: true } },
        certificateTemplates: { select: { id: true, name: true, approvedAt: true } },
      },
    });
    return NextResponse.json(orgs);
  });
}
