import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudioUser, maxLevelFor } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** GET /api/admin/loop/conversations — the signed-in Super Admin's own saved chats, newest first. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    const rows = await prisma.loopConversation.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, level: true, updatedAt: true },
    });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { loopLevel: true } });
    const maxLevel = await maxLevelFor(session);
    return NextResponse.json({ conversations: rows, defaultLevel: Math.min(me?.loopLevel ?? 1, maxLevel), maxLevel });
  });
}
