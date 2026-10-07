import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveNotificationRecipient } from "@/lib/notifications/recipientScope";

/**
 * POST /api/notifications/[id]/read — ownership checked directly, the
 * same discipline every other resource in this project applies: a
 * notification must genuinely belong to the caller (matching both
 * recipientType and recipientId), never trusted from the URL alone —
 * see resolveNotificationRecipient's own comment for why this isn't
 * just `session.userId` for a training-org-backed ADMIN session.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole();
    const { recipientType, recipientId } = await resolveNotificationRecipient(session);

    const notification = await prisma.userNotification.findUnique({ where: { id: params.id } });
    if (!notification || notification.recipientType !== recipientType || notification.recipientId !== recipientId) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const updated = await prisma.userNotification.update({
      where: { id: params.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json(updated);
  });
}
