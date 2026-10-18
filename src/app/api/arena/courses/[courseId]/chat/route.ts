import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { postChat } from "@/lib/arena/chat";
import { PICK_RATE } from "@/lib/arena/arenaCore";

export const dynamic = "force-dynamic";

const Body = z.object({ body: z.string().min(1).max(500) });

/** POST: say something in this course's arena chat. */
export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Write a short message first.");
    await limit(`arena:chat:${me}`, PICK_RATE.messages, PICK_RATE.messagesPer);
    await postChat(me, params.courseId, parsed.data.body);
    return { ok: true };
  });
}
