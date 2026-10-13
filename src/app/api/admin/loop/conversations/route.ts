import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/** GET /api/admin/loop/conversations — the signed-in Super Admin's own saved chats, newest first. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const rows = await prisma.loopConversation.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, level: true, updatedAt: true },
    });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { loopLevel: true } });
    return NextResponse.json({ conversations: rows, defaultLevel: me?.loopLevel ?? 1 });
  });
}
