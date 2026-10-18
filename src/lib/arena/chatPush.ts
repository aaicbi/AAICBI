import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push/send";

/** A short note to every other enrolled trainee's phone, like an instant message. One per person per course every 20 seconds, so a busy chat does not flood. */
const lastPush = new Map<string, number>();
export async function pushToCourse(courseId: string, exceptId: string | null, n: { title: string; body: string; url?: string }, only?: string[]): Promise<void> {
  try {
    const people = only ?? (await prisma.courseEnrollment.findMany({ where: { courseId, unlockedAt: { not: null }, accessRevokedAt: null }, select: { traineeId: true }, take: 300 })).map((e) => e.traineeId);
    const now = Date.now();
    for (const id of people) {
      if (id === exceptId) continue;
      const key = `${courseId}:${id}`;
      if (!only && now - (lastPush.get(key) ?? 0) < 20_000) continue;
      lastPush.set(key, now);
      void sendPushForNotification("TRAINEE", id, { type: `ARENA_TALK_${courseId}`, title: n.title, body: n.body, url: n.url ?? `/trainee/arena/${courseId}/chat` });
    }
    if (lastPush.size > 5000) lastPush.clear();
  } catch { /* a push that fails must never break the chat */ }
}

