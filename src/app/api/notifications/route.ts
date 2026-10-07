import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveNotificationRecipient } from "@/lib/notifications/recipientScope";

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
 * Training Organizations, Phase 2 — confirmed real bug, fixed here: a
 * training org's own ADMIN session (TrainingOrganization.staffUserId)
 * was being treated as "STAFF" like any real AAICBI staff member,
 * which meant it saw every genuine staff-only notification (other
 * organizations' approval queue, platform-wide payment receipts, etc.)
 * and never saw its OWN notifications at all. See
 * resolveNotificationRecipient's own comment (src/lib/notifications/
 * recipientScope.ts) for the full fix, shared with the mark-read routes.
 *
 * Returns the unread count alongside the list itself so the bell can
 * show a badge without a second request.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole();
    const { recipientType, recipientId } = await resolveNotificationRecipient(session);

    const [notifications, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where: { recipientType, recipientId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.userNotification.count({
        where: { recipientType, recipientId, readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  });
}
