import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { answerSprint } from "@/lib/arena/sprint";

export const dynamic = "force-dynamic";

const Body = z.object({ choice: z.string().min(1).max(4) });

/** POST { choice } — answer a Fastest Fingers question. One try each; the first right answer wins. */
export async function POST(req: NextRequest, { params }: { params: { courseId: string; sprintId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose one of the answers.");
    await limit(`arena:sprint:${me}`, 20, 60_000);
    return answerSprint(me, params.courseId, params.sprintId, parsed.data.choice);
  });
}
