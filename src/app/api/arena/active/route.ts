import { prisma } from "@/lib/prisma";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { activeMatchOf } from "@/lib/arena/arena";

export const dynamic = "force-dynamic";

/** GET: the signed-in trainee's game that is waiting for them (or a challenge sent to them), for the "return to your game" pill on other pages. */
export async function GET() {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const m = await activeMatchOf(me);
    if (!m) return { match: null };
    const other = await prisma.trainee.findUnique({ where: { id: m.challengerId === me ? m.opponentId : m.challengerId }, select: { name: true } });
    const kind = m.status === "PENDING" ? (m.opponentId === me ? "challenge" : "waiting") : "game";
    return { match: { id: m.id, kind, status: m.status, opponentName: other?.name ?? "A coursemate", paused: m.pausedById !== null } };
  });
}
