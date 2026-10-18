import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { viewMatch } from "@/lib/arena/arenaView";
import { touchPresenceSoon } from "@/lib/arena/arena";

export const dynamic = "force-dynamic";

/** GET — this match as the signed-in player sees it (private details removed). Late deadlines are settled first. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const view = await viewMatch(params.id, me);
    if (view.status === "ACTIVE" || view.status === "LOBBY" || view.status === "PENDING") await touchPresenceSoon(me, view.courseId);
    return view;
  });
}
