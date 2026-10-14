import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { createGame, isGameFormat } from "@/lib/quest/studio";

const Body = z.object({ title: z.string().min(1).max(120), format: z.string().refine(isGameFormat, "Unknown format"), description: z.string().max(500).nullish() });

/** POST /api/admin/studio/games — create a game in the library. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "GAMES");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Give the game a name and a format." }, { status: 400 });
    const game = await createGame(session.userId, { title: parsed.data.title, format: parsed.data.format as never, description: parsed.data.description });
    return NextResponse.json(game, { status: 201 });
  });
}
