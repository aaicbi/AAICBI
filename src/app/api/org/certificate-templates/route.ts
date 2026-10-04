import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/org/certificate-templates — the org's own approved templates
 * only (never a pending one — nothing to assign until a SUPER_ADMIN
 * designs it and the org itself approves it via the share link), for
 * the per-course assignment dropdown on their dashboard.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINING_ORG");
    const templates = await prisma.certificateTemplate.findMany({
      where: { trainingOrganizationId: session.userId, approvedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
    return NextResponse.json(templates);
  });
}
