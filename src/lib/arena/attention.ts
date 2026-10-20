import { prisma } from "@/lib/prisma";
import { chatSummaries, type ChatSummary } from "@/lib/arena/chat";
import { activeMatchOf } from "@/lib/arena/arena";
import { challengeAlertsMuted } from "@/lib/arena/prefs";

export interface Attention { chats: ChatSummary[]; direct: number; challenge: boolean; total: number }

/**
 * Everything waiting for a trainee in the arena and messages: unread course group chats, unread direct and cohort messages, and a challenge
 * someone is waiting on (unless they muted challenge alerts). `total` is the number on the app icon. The page's own check and every
 * push to their phone use this one count, so the icon always shows the same number.
 */
export async function attentionOf(me: string): Promise<Attention> {
  const [chats, parts, active] = await Promise.all([
    chatSummaries(me),
    prisma.conversationParticipant.findMany({ where: { participantType: "TRAINEE", participantId: me }, select: { conversationId: true, lastReadAt: true }, take: 40 }),
    activeMatchOf(me),
  ]);
  const direct = (await Promise.all(parts.map((p) => prisma.conversationMessage.count({ where: { conversationId: p.conversationId, createdAt: { gt: p.lastReadAt ?? new Date(0) }, NOT: { authorType: "TRAINEE", authorId: me } } })))).reduce((a, b) => a + b, 0);
  const challenge = !!active && active.status === "PENDING" && active.opponentId === me && !(await challengeAlertsMuted(me));
  const groups = chats.reduce((a, c) => a + c.unread, 0);
  return { chats, direct, challenge, total: groups + direct + (challenge ? 1 : 0) };
}
