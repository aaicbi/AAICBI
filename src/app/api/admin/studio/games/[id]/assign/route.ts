import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { assignGame } from "@/lib/quest/studio";

const Body = z.object({ moduleId: z.string().min(1), assigned: z.boolean(), live: z.boolean().optional(), openToVisitors: z.boolean().optional() });

/** PUT — assign a game to a module (or remove it), and switch it live or off there. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "ASSIGN");
    await requireStudioGame(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a module." }, { status: 400 });
    await requireStudioModule(parsed.data.moduleId, session);
    await assignGame(params.id, parsed.data.moduleId, { assigned: parsed.data.assigned, live: parsed.data.live, openToVisitors: parsed.data.openToVisitors });
    return NextResponse.json({ ok: true });
  });
}
