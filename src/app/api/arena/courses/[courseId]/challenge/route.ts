import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { challengeInChat } from "@/lib/arena/chat";
import { PICK_RATE } from "@/lib/arena/arenaCore";

export const dynamic = "force-dynamic";

const Body = z.object({ opponentId: z.string().min(1), moduleId: z.string().min(1).nullish() });

/** POST — challenge an online coursemate, optionally to one topic. */
export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose a coursemate to challenge.");
    await limit(`arena:challenge:${me}`, PICK_RATE.challenges, PICK_RATE.challengesPer);
    const m = await challengeInChat({ challengerId: me, opponentId: parsed.data.opponentId, courseId: params.courseId, moduleId: parsed.data.moduleId });
    return { id: m.id, reach: m.reach };
  });
}
