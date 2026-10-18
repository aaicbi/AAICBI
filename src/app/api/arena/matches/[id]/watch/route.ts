import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { spectateView } from "@/lib/arena/spectate";

export const dynamic = "force-dynamic";

/** GET — a live match as a spectator may see it (no answer key until the round is revealed). Also counts the viewer as watching. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return arenaJson(async () => spectateView(await arenaTrainee(), params.id));
}
