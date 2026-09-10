import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/admin/inbox/[id]/read — marks one SuperAdminMessage read,
 * team-wide (see that model's own schema comment for why this isn't
 * per-viewer). Idempotent: whichever Super Admin gets there first
 * records readById; a second Super Admin opening an already-read
 * message doesn't overwrite who actually handled it.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const message = await prisma.superAdminMessage.findUnique({ where: { id: params.id } });
    if (!message) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (message.readAt) {
      return NextResponse.json(message);
    }

    const updated = await prisma.superAdminMessage.update({
      where: { id: params.id },
      data: { readAt: new Date(), readById: session.userId },
    });
    return NextResponse.json(updated);
  });
}
