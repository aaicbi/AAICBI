import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { joinEvent, leaveEvent } from "@/lib/arena/event";

export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["join", "leave"]) });

/** POST { action } — take a place in an event that has not started, or give it up. */
export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose join or leave.");
    if (parsed.data.action === "join") await joinEvent(me, params.eventId); else await leaveEvent(me, params.eventId);
    return { ok: true };
  });
}
