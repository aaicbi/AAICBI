import { prisma } from "@/lib/prisma";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { chatSummaries } from "@/lib/arena/chat";
import { activeMatchOf } from "@/lib/arena/arena";
import { challengeAlertsMuted } from "@/lib/arena/prefs";

export const dynamic = "force-dynamic";

/**
 * GET — what needs the trainee's attention in the arena and messages: unread course group chats, unread direct and cohort messages,
 * and a waiting challenge. `total` is the number for the app icon.
 */
export async function GET() {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const [chats, parts, active] = await Promise.all([
      chatSummaries(me),
      prisma.conversationParticipant.findMany({ where: { participantType: "TRAINEE", participantId: me }, select: { conversationId: true, lastReadAt: true }, take: 40 }),
      activeMatchOf(me),
    ]);
    const direct = (await Promise.all(parts.map((p) => prisma.conversationMessage.count({ where: { conversationId: p.conversationId, createdAt: { gt: p.lastReadAt ?? new Date(0) }, NOT: { authorType: "TRAINEE", authorId: me } } })))).reduce((a, b) => a + b, 0);
    const challenge = !!active && active.status === "PENDING" && active.opponentId === me && !(await challengeAlertsMuted(me));
    const groups = chats.reduce((a, c) => a + c.unread, 0);
    return { chats, direct, challenge, total: groups + direct + (challenge ? 1 : 0) };
  });
}
