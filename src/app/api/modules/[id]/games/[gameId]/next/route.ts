import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { serveGameItem } from "@/lib/quest/studio";

/** POST — serve the next item of a game. The answer key is never sent; the server starts the clock. */
export async function POST(_req: Request, { params }: { params: { id: string; gameId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const served = await serveGameItem(session.userId, params.id, params.gameId);
    return NextResponse.json(served ?? { done: true });
  });
}
