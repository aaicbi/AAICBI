import { prisma } from "@/lib/prisma";

export type NotificationRecipientType = "TRAINEE" | "STAFF" | "EMPLOYER";

/**
 * Personalized landing page — "since your last visit" and the
 * on-dashboard notification summary are BOTH derived from the
 * existing `UserNotification` table (see GET /api/notifications for
 * the same model consumed by the header bell) rather than a new
 * activity-log table. Every real event that already generates a
 * notification (module unlock, assessment result, certificate issued,
 * introduction accepted, job posting decided, etc. — see
 * src/lib/notifications/log.ts) is automatically "recent activity"
 * for free, with no new write path to build or keep in sync.
 */
export async function getRecentNotifications(
  recipientType: NotificationRecipientType,
  recipientId: string,
  limit = 5
) {
  return prisma.userNotification.findMany({
    where: { recipientType, recipientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount(recipientType: NotificationRecipientType, recipientId: string) {
  return prisma.userNotification.count({ where: { recipientType, recipientId, readAt: null } });
}

/**
 * Events created strictly after `since` — the cutoff is the account's
 * `previousLoginAt`, not `lastLoginAt` (which the login route already
 * overwrote with "now" by the time this runs). Returns an empty array
 * for a first-ever visit (`since` null) rather than showing everything
 * ever sent, which wouldn't honestly answer "what changed since I was
 * last here."
 */
export async function getEventsSinceLastVisit(
  recipientType: NotificationRecipientType,
  recipientId: string,
  since: Date | null,
  limit = 10
) {
  if (!since) return [];
  return prisma.userNotification.findMany({
    where: { recipientType, recipientId, createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
