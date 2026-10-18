import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { reportMatch } from "@/lib/arena/moderation";

export const dynamic = "force-dynamic";

const Body = z.object({ reason: z.string().min(1).max(20), note: z.string().max(600).nullish(), reportedId: z.string().min(1).nullish() });

/** POST { reason, note?, reportedId? } — report a match you played or watched to the course's moderators. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose a reason.");
    return reportMatch(me, params.id, parsed.data);
  });
}
