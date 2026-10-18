import { prisma } from "@/lib/prisma";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { activeMatchOf, touchPresence } from "@/lib/arena/arena";
import { availabilityForCourse } from "@/lib/arena/config";

export const dynamic = "force-dynamic";

/** GET: also marks the trainee online in their arenas. The signed-in trainee's game that is waiting for them (or a challenge sent to them), for the "return to your game" pill on other pages. */
export async function GET() {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    // Being signed in and looking at the app counts as being online: show up on the lists of every arena you can play in.
    const courses = await prisma.courseEnrollment.findMany({ where: { traineeId: me, unlockedAt: { not: null }, accessRevokedAt: null }, select: { courseId: true }, take: 20 });
    for (const c of courses) {
      if ((await availabilityForCourse(c.courseId)).game) await touchPresence(me, c.courseId).catch(() => undefined);
    }
    const m = await activeMatchOf(me);
    if (!m) return { match: null };
    const other = await prisma.trainee.findUnique({ where: { id: m.challengerId === me ? m.opponentId : m.challengerId }, select: { name: true } });
    const kind = m.status === "PENDING" ? (m.opponentId === me ? "challenge" : "waiting") : "game";
    return { match: { id: m.id, kind, status: m.status, opponentName: other?.name ?? "A coursemate", paused: m.pausedById !== null } };
  });
}
