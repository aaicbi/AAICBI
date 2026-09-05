import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/notifications/read-all — the common "mark all as read"
 * action every real notification feed offers. A bulk update, scoped
 * to exactly this caller's own unread notifications.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole();
    const recipientType = session.role === "TRAINEE" ? "TRAINEE" : session.role === "EMPLOYER" ? "EMPLOYER" : "STAFF";

    await prisma.userNotification.updateMany({
      where: { recipientType, recipientId: session.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
