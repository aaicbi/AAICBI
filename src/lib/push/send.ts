import { prisma } from "@/lib/prisma";
import { buildPushPayload } from "@/lib/push/core";

/**
 * Sends a web push for a notification that was just written. It does nothing
 * unless the VAPID keys are configured, never throws (a failed push must
 * never break the action that caused it), and removes subscriptions the push
 * service says are gone. Called after a notification is created; the in-app
 * notification remains the source of truth.
 */
export function pushIsConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushForNotification(
  recipientType: string,
  recipientId: string,
  n: { type: string; title: string; body: string; url?: string | null },
): Promise<void> {
  if (!pushIsConfigured()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { recipientType, recipientId }, take: 10 });
    if (subs.length === 0) return;
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@aaicbi.org", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string, process.env.VAPID_PRIVATE_KEY as string);
    const payload = JSON.stringify(buildPushPayload(n));
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
          await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }),
    );
  } catch (e) {
    console.error("Web push failed:", e);
  }
}
