import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/guide/history — SUPER_ADMIN: the latest changes to answers and the latest decisions on questions. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const [changes, decided] = await Promise.all([
      prisma.guideEntryVersion.findMany({ orderBy: { changedAt: "desc" }, take: 60, select: { id: true, entryId: true, version: true, action: true, question: true, changedByName: true, changeNote: true, changedAt: true } }),
      prisma.guideUnanswered.findMany({ where: { reviewedAt: { not: null } }, orderBy: { reviewedAt: "desc" }, take: 60, select: { id: true, text: true, status: true, asked: true, reviewedAt: true, reviewNote: true, entryId: true } }),
    ]);
    return NextResponse.json({ changes, decided });
  });
}
