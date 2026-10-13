import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { liveGamesForTrainee } from "@/lib/quest/studio";

/** GET /api/modules/[id]/games — the games live for this module (same access rules as the module itself). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    return NextResponse.json({ games: await liveGamesForTrainee(session.userId, params.id) });
  });
}
