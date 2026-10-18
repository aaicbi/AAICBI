import { NextRequest } from "next/server";
import { z } from "zod";
import { arenaJson, arenaTrainee, limit } from "@/lib/arena/arenaApi";
import { ArenaError } from "@/lib/arena/arena";
import { transferCredits } from "@/lib/arena/wallet";

export const dynamic = "force-dynamic";

const Body = z.object({ toId: z.string().min(1), amount: z.number().int().min(1).max(1000) });

/** POST { toId, amount } — send credits to a coursemate. Refused while the wallet switch is off. */
export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ArenaError("Choose a coursemate and a number of credits.");
    await limit(`arena:transfer:${me}`, 10, 60_000);
    return transferCredits({ fromId: me, toId: parsed.data.toId, courseId: params.courseId, amount: parsed.data.amount });
  });
}
