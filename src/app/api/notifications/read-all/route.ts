import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveNotificationRecipient } from "@/lib/notifications/recipientScope";

/**
 * POST /api/notifications/read-all — the common "mark all as read"
 * action every real notification feed offers. A bulk update, scoped
 * to exactly this caller's own unread notifications — see
 * resolveNotificationRecipient's own comment for why this isn't just
 * `session.userId` for a training-org-backed ADMIN session.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole();
    const { recipientType, recipientId } = await resolveNotificationRecipient(session);

    await prisma.userNotification.updateMany({
      where: { recipientType, recipientId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
