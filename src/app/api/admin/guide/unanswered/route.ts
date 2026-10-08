import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { sortQueue, toQueueRow } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "IN_REVIEW", "ANSWERED", "DISMISSED", "REJECTED", "MERGED"] as const;

/**
 * GET /api/admin/guide/unanswered — SUPER_ADMIN reads the review queue.
 * Filters: status (default: waiting, i.e. open and in review), role, category,
 * feature, q (text search). Sorted by priority.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ?? "WAITING";
    const where: Prisma.GuideUnansweredWhereInput = {};
    if (status === "WAITING") where.status = { in: ["OPEN", "IN_REVIEW"] };
    else if ((STATUSES as readonly string[]).includes(status)) where.status = status as (typeof STATUSES)[number];
    const role = sp.get("role");
    if (role) where.lastRole = role;
    const category = sp.get("category");
    if (category) where.category = category;
    const feature = sp.get("feature");
    if (feature) where.feature = feature;
    const q = sp.get("q")?.trim().slice(0, 100);
    if (q) where.OR = [{ text: { contains: q.toLowerCase() } }, { variants: { has: q.toLowerCase() } }];
    const rows = await prisma.guideUnanswered.findMany({ where, orderBy: [{ asked: "desc" }, { lastAskedAt: "desc" }], take: 300 });
    return NextResponse.json({ questions: sortQueue(rows.map(toQueueRow)) });
  });
}
