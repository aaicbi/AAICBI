import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { viewMatch } from "@/lib/arena/arenaView";

export const dynamic = "force-dynamic";

/** GET — this match as the signed-in player sees it (private details removed). Late deadlines are settled first. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return arenaJson(async () => viewMatch(params.id, await arenaTrainee()));
}
