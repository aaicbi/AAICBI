import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioCan } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { recordAudit } from "@/lib/rbac/audit";
import { assignGame } from "@/lib/quest/studio";
import { prisma } from "@/lib/prisma";

const Body = z.object({ moduleId: z.string().min(1), assigned: z.boolean(), live: z.boolean().optional(), openToVisitors: z.boolean().optional() });

/** PUT — assign a game to a module (or remove it), and switch it live or off there. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    await requireStudioGame(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a module." }, { status: 400 });
    requireStudioCan(session, "gaming_studio.games:manage");
    // Switching a game live or off, or opening it to visitors, is Publish: judged by what actually changes, so attaching a game (still off) is only Manage.
    const existing = await prisma.gameAssignment.findUnique({ where: { gameId_moduleId: { gameId: params.id, moduleId: parsed.data.moduleId } }, select: { live: true, openToVisitors: true } });
    const wasLive = existing?.live ?? false, wasFeed = existing?.openToVisitors ?? false;
    const willLive = parsed.data.assigned ? (parsed.data.live ?? wasLive) : false;
    const willFeed = parsed.data.assigned ? (parsed.data.openToVisitors ?? wasFeed) : false;
    const publishChange = willLive !== wasLive || willFeed !== wasFeed;
    if (publishChange) requireStudioCan(session, "gaming_studio.games:publish");
    await requireStudioModule(parsed.data.moduleId, session);
    await assignGame(params.id, parsed.data.moduleId, { assigned: parsed.data.assigned, live: parsed.data.live, openToVisitors: parsed.data.openToVisitors });
    if (willLive !== wasLive) await recordAudit({ actorId: session.userId, actorRole: session.role, action: willLive ? "GAME_PUBLISHED" : "GAME_UNPUBLISHED", resourceType: "game", resourceId: params.id, after: { moduleId: parsed.data.moduleId, openToVisitors: willFeed } });
    return NextResponse.json({ ok: true });
  });
}
