import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * PATCH /api/exams/[id]/access/[grantId] — revoke a trainee's access
 * to a standalone exam. Soft revoke, same shape as
 * PATCH /api/courses/[id]/enrollments/[enrollmentId] — see that
 * route's own comment for the "mark, never delete" reasoning.
 */
export async function PATCH(_req: NextRequest, { params }: { params: { id: string; grantId: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const grant = await prisma.examAccessGrant.findUnique({ where: { id: params.grantId } });
    if (!grant || grant.examId !== params.id) {
      return NextResponse.json({ error: "Access grant not found." }, { status: 404 });
    }
    if (grant.revokedAt) {
      return NextResponse.json(grant); // already revoked — idempotent, not an error
    }

    const revoked = await prisma.examAccessGrant.update({
      where: { id: params.grantId },
      data: { revokedAt: new Date() },
      include: { trainee: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(revoked);
  });
}
