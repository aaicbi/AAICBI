import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { sanitizeLinks } from "@/lib/guide/links";

export const dynamic = "force-dynamic";

/** GET /api/admin/guide/entries/[id]/versions — SUPER_ADMIN reads an answer's history, newest first. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const rows = await prisma.guideEntryVersion.findMany({ where: { entryId: params.id }, orderBy: { version: "desc" }, take: 100 });
    return NextResponse.json({
      versions: rows.map((v) => ({
        version: v.version, action: v.action, question: v.question, answer: v.answer, links: sanitizeLinks(v.links), keywords: v.keywords,
        category: v.category, navHref: v.navHref, navLabel: v.navLabel, target: v.target, relatedQuestions: v.relatedQuestions, roles: v.roles,
        enabled: v.enabled, changedByName: v.changedByName, changeNote: v.changeNote, changedAt: v.changedAt,
      })),
    });
  });
}
