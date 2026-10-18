import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { eventView } from "@/lib/arena/event";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET — a live event as a trainee sees it: the bracket, who is playing, and where they stand. */
export async function GET(_req: Request, { params }: { params: { eventId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const ev = await prisma.arenaEvent.findUnique({ where: { id: params.eventId }, select: { courseId: true } });
    if (!ev) throw new ArenaError("That event could not be found.", 404);
    if (!(await isEnrolled(me, ev.courseId))) throw new ArenaError("The event is for trainees enrolled in this course.", 403);
    return eventView(params.eventId, me);
  });
}
