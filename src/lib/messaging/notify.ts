import { prisma } from "@/lib/prisma";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { sendPushForNotification } from "@/lib/push/send";
import { conversationPath, newMessageNotice } from "@/lib/messaging/policy";
import type { ActorType } from "@/lib/messaging";

/**
 * Tells the other person in a direct conversation that a message arrived: one
 * unread notification per conversation (a burst of messages updates it rather
 * than piling up), and a web push for each message. The notification says who
 * wrote, never what; a failure here never blocks sending. A training
 * organization's staff are notified in the organization's own bell.
 */
export async function notifyNewDirectMessage(conversationId: string, from: { type: ActorType; id: string; name: string }, to: { type: ActorType; id: string }): Promise<void> {
  try {
    let recipientType: string = to.type;
    let recipientId = to.id;
    if (to.type === "STAFF") {
      const org = await findTrainingOrgByStaffUserId(to.id).catch(() => null);
      if (org) {
        recipientType = "TRAINING_ORG";
        recipientId = org.id;
      }
    }
    const url = conversationPath(to.type, conversationId);
    const notice = { type: "NEW_MESSAGE", ...newMessageNotice(from.name), url };
    const unread = await prisma.userNotification.findFirst({ where: { recipientType, recipientId, type: "NEW_MESSAGE", url, readAt: null }, select: { id: true } });
    if (unread) {
      await prisma.userNotification.update({ where: { id: unread.id }, data: { title: notice.title, createdAt: new Date() } });
    } else {
      await prisma.userNotification.create({ data: { recipientType, recipientId, type: notice.type, title: notice.title, body: notice.body, url } });
    }
    await sendPushForNotification(recipientType, recipientId, notice);
  } catch (e) {
    console.error("Failed to notify about a new message:", e);
  }
}
