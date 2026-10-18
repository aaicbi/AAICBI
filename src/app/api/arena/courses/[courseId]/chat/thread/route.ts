import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { chatFor } from "@/lib/arena/chat";
import { activeSuspension, suspensionText } from "@/lib/arena/suspension";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET — just the chat (messages and cards) and whether this trainee is suspended, for the Messages button's group chat view. */
export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    if (!(await isEnrolled(me, params.courseId))) throw new ArenaError("The chat is for trainees enrolled in this course.", 403);
    const [chat, sus, course] = await Promise.all([chatFor(params.courseId, me), activeSuspension(me, params.courseId), prisma.course.findUnique({ where: { id: params.courseId }, select: { title: true } })]);
    return { title: course?.title ?? "Course chat", chat, suspended: sus ? suspensionText(sus) : null };
  });
}
