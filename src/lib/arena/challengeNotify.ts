/**
 * Ayakbi Arena: challenge notifications. The challenged player gets an entry in their notification bell and a push to their phone;
 * the challenger is told when the answer comes. Never throws: a notification that fails must not break the challenge.
 */
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push/send";
import { challengeNotice, replyNotice, expiredNotice, CHALLENGE_TYPE, type ChallengeFacts } from "@/lib/arena/challengeNotifyCore";

async function facts(m: { id: string; courseId: string; challengerId: string; opponentId: string; moduleId: string | null; rematchOfId: string | null }): Promise<ChallengeFacts> {
  const [course, from, to, mod] = await Promise.all([
    prisma.course.findUnique({ where: { id: m.courseId }, select: { title: true } }),
    prisma.trainee.findUnique({ where: { id: m.challengerId }, select: { name: true } }),
    prisma.trainee.findUnique({ where: { id: m.opponentId }, select: { name: true } }),
    m.moduleId ? prisma.module.findUnique({ where: { id: m.moduleId }, select: { title: true } }) : null,
  ]);
  return { matchId: m.id, courseId: m.courseId, courseTitle: course?.title ?? "Your course", fromName: from?.name ?? "", toName: to?.name ?? "", topic: mod?.title ?? null, rematch: !!m.rematchOfId };
}

async function deliver(recipientId: string, note: { type: string; title: string; body: string; url: string }) {
  await prisma.userNotification.create({ data: { recipientType: "TRAINEE", recipientId, ...note } });
  await sendPushForNotification("TRAINEE", recipientId, note);
}

type MatchRow = Parameters<typeof facts>[0];

export async function notifyChallenge(m: MatchRow): Promise<void> {
  try { await deliver(m.opponentId, challengeNotice(await facts(m))); } catch (e) { console.error("Challenge notification failed:", e); }
}

export async function notifyChallengeReply(m: MatchRow, accepted: boolean): Promise<void> {
  try {
    await deliver(m.challengerId, replyNotice(await facts(m), accepted));
    // The invitation is answered: it should not keep nagging from the bell.
    await prisma.userNotification.updateMany({ where: { recipientType: "TRAINEE", recipientId: m.opponentId, type: CHALLENGE_TYPE, url: `/trainee/arena/match/${m.id}`, readAt: null }, data: { readAt: new Date() } });
  } catch (e) { console.error("Challenge reply notification failed:", e); }
}

/** Nobody answered in time: tell the challenger, and take the invitation off the other player's bell. */
export async function notifyChallengeExpired(m: MatchRow): Promise<void> {
  try {
    await deliver(m.challengerId, expiredNotice(await facts(m)));
    await prisma.userNotification.updateMany({ where: { recipientType: "TRAINEE", recipientId: m.opponentId, type: CHALLENGE_TYPE, url: `/trainee/arena/match/${m.id}`, readAt: null }, data: { readAt: new Date() } });
  } catch (e) { console.error("Challenge expiry notification failed:", e); }
}
