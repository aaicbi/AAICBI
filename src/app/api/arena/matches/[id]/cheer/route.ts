import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { cheer } from "@/lib/arena/spectate";

export const dynamic = "force-dynamic";

const Body = z.object({ kind: z.string().min(1).max(20) });

/** POST { kind } — cheer for the players with an emoji. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose one of the cheers.");
    await limit(`arena:cheer:${me}`, 40, 60_000);
    await cheer(me, params.id, parsed.data.kind);
    return { ok: true };
  });
}
