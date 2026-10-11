import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/admin/guide/consultant/suggestions?status=PENDING|APPROVED|DISMISSED|ALL — SUPER_ADMIN reads the consultant's proposals and advice. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
    const rows = await prisma.guideSuggestion.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    // For a proposal about a waiting question, include the question as it stands now.
    const qIds = rows.map((r) => r.questionId).filter((x): x is string => !!x);
    const qs = qIds.length ? await prisma.guideUnanswered.findMany({ where: { id: { in: qIds } }, select: { id: true, text: true, asked: true, status: true } }) : [];
    const byId = new Map(qs.map((q) => [q.id, q]));
    return NextResponse.json({ suggestions: rows.map((r) => ({ ...r, question: r.questionId ? byId.get(r.questionId) ?? null : null })) });
  });
}
