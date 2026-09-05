import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/notifications — the real in-app feed behind the
 * notification bell, working identically for all three account types.
 * `requireRole()` with no arguments authenticates without restricting
 * to a specific role — the caller's actual role determines which
 * `recipientType` bucket to read from, the same three staff roles
 * (SUPER_ADMIN/ADMIN/INSTRUCTOR) all mapping to the single "STAFF"
 * bucket `UserNotification`/`NotificationLog` already use for
 * staff-directed notifications.
 *
 * Returns the unread count alongside the list itself so the bell can
 * show a badge without a second request.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole();
    const recipientType = session.role === "TRAINEE" ? "TRAINEE" : session.role === "EMPLOYER" ? "EMPLOYER" : "STAFF";

    const [notifications, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where: { recipientType, recipientId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.userNotification.count({
        where: { recipientType, recipientId: session.userId, readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  });
}
