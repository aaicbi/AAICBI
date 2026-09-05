import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * PATCH /api/certificates/[id] — revoke or restore a certificate.
 * Closes a gap flagged since M15: Certificate.revokedAt has existed
 * since that milestone, and the public verification page already
 * checks it, but nothing anywhere could actually set it except direct
 * database access. `[id]` here is the certificate's own id, not its
 * public code — this route is staff-only and reached from the admin
 * certificates list, which already has the id.
 *
 * Ownership-checked through the course the certificate belongs to
 * (same pattern as every other staff-facing resource in this project)
 * — an instructor can only revoke a certificate for a course they
 * created, not anyone else's.
 */
const PatchSchema = z.object({ revoked: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const certificate = await prisma.certificate.findUnique({ where: { id: params.id } });
    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    }
    await requireOwnedCourse(certificate.courseId, session.userId);

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.certificate.update({
      where: { id: params.id },
      data: { revokedAt: parsed.data.revoked ? new Date() : null },
    });
    return NextResponse.json(updated);
  });
}
