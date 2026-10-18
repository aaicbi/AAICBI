import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { markChatRead } from "@/lib/arena/chat";

export const dynamic = "force-dynamic";

/** POST — the trainee has looked at this course's chat. */
export async function POST(_req: Request, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    if (!(await isEnrolled(me, params.courseId))) throw new ArenaError("The chat is for trainees enrolled in this course.", 403);
    await markChatRead(me, params.courseId);
    return { ok: true };
  });
}
