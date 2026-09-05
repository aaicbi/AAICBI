import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/notifications/[id]/read — ownership checked directly, the
 * same discipline every other resource in this project applies: a
 * notification must genuinely belong to the caller (matching both
 * recipientType and recipientId), never trusted from the URL alone.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole();
    const recipientType = session.role === "TRAINEE" ? "TRAINEE" : session.role === "EMPLOYER" ? "EMPLOYER" : "STAFF";

    const notification = await prisma.userNotification.findUnique({ where: { id: params.id } });
    if (!notification || notification.recipientType !== recipientType || notification.recipientId !== session.userId) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const updated = await prisma.userNotification.update({
      where: { id: params.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json(updated);
  });
}
