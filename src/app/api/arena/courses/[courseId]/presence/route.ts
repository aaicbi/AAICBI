import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { clearPresence } from "@/lib/arena/arena";

export const dynamic = "force-dynamic";

/** POST: the page is closing, so this player is no longer in the arena. Sent with sendBeacon when the screen is left. */
export async function POST(_req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    await clearPresence(me, params.courseId);
    return { ok: true };
  });
}
