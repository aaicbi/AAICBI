/**
 * Sends one Loop broadcast: re-resolves the recipients against the live
 * database (never trusts an id list), records the broadcast with who
 * authorised it, fans it out, and records the outcome. Shared by the
 * confirm-card route and by Loop's own "send message" action so both follow
 * the same rules.
 */
import { prisma } from "@/lib/prisma";
import { resolveRecipients, type RecipientFilter } from "@/lib/messaging/recipients";
import { sendBroadcast } from "@/lib/messaging/broadcast";
import { describeBroadcastStatus } from "@/lib/messaging/broadcastCore";

export const LOOP_SENDER_LABEL = "Loop — Systems Manager";

export async function sendLoopBroadcast(args: {
  authorizedById: string;
  recipientFilter: RecipientFilter;
  recipientDescription: string;
  recipientCountExpected: number;
  subject: string;
  body: string;
  category: string;
}) {
  const resolved = await resolveRecipients(args.recipientFilter);
  const recipientCountActual = resolved.recipients.length;

  const broadcast = await prisma.loopBroadcast.create({
    data: {
      authorizedById: args.authorizedById,
      senderLabel: LOOP_SENDER_LABEL,
      recipientDescription: args.recipientDescription,
      recipientFilter: args.recipientFilter as object,
      recipientCountExpected: args.recipientCountExpected,
      recipientCountActual,
      category: args.category,
      subject: args.subject,
      body: args.body,
      status: "FAILED", // placeholder until the fan-out below reports in
    },
  });

  const { sentCount, failedCount } = await sendBroadcast({
    recipients: resolved.recipients,
    senderLabel: LOOP_SENDER_LABEL,
    subject: args.subject,
    body: args.body,
    broadcastId: broadcast.id,
  });
  await prisma.loopBroadcast.update({ where: { id: broadcast.id }, data: { status: describeBroadcastStatus(sentCount, failedCount) } });

  return {
    broadcastId: broadcast.id,
    sentCount,
    failedCount,
    recipientCountActual,
    countChanged: recipientCountActual !== args.recipientCountExpected,
  };
}
