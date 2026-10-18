import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { requireArena, touchPresence } from "@/lib/arena/arena";
import { courseArenaView } from "@/lib/arena/arenaView";

export const dynamic = "force-dynamic";

/** GET — the course lobby for the signed-in trainee. Reading it also counts as "online in the arena". */
export async function GET(_req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    await requireArena(me, params.courseId);
    await touchPresence(me, params.courseId);
    return courseArenaView(me, params.courseId);
  });
}
