import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { walletView } from "@/lib/arena/wallet";

export const dynamic = "force-dynamic";

/** GET — this trainee's credits, recent history and who they could send credits to. `enabled` is false until a Super Admin switches the wallet on. */
export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => walletView(await arenaTrainee(), params.courseId));
}
