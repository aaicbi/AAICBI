import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/inbox — the receiving side of the simple direct inbox
 * (see SuperAdminMessage's own schema comment). SUPER_ADMIN only. A
 * shared team inbox, not a per-admin one — every Super Admin sees the
 * exact same list and the same read state.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const [messages, unreadCount] = await Promise.all([
      prisma.superAdminMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.superAdminMessage.count({ where: { readAt: null } }),
    ]);

    return NextResponse.json({ messages, unreadCount });
  });
}
