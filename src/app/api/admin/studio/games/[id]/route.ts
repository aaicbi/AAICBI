import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { deleteGame, updateGame } from "@/lib/quest/studio";

const Patch = z.object({ title: z.string().max(120).optional(), description: z.string().max(500).nullish(), enabledRewards: z.array(z.string()).optional() });

/** PATCH — rename a game, change its description or its rewards. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "GAMES");
    await requireStudioGame(params.id, session);
    const parsed = Patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    await updateGame(params.id, parsed.data);
    return NextResponse.json({ ok: true });
  });
}

/** DELETE — remove a game from the library. A live quiz game switches its modules' practice off first. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "GAMES");
    await requireStudioGame(params.id, session);
    await deleteGame(params.id);
    return NextResponse.json({ deleted: true });
  });
}
