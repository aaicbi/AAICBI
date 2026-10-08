import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { sanitizeLinks } from "@/lib/guide/links";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";
import { guideMetrics } from "@/lib/guide/knowledge";
import { GUIDE_CATEGORIES } from "@/lib/guide/adminSchemas";

export const dynamic = "force-dynamic";

/**
 * GET/PUT /api/admin/guide — SUPER_ADMIN only. Loop's switch, the approved
 * answers (the knowledge base), the overview numbers and the categories in
 * use. The review queue and the history have their own routes.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const [settings, entries, metrics] = await Promise.all([
      prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } }),
      prisma.guideEntry.findMany({ orderBy: { updatedAt: "desc" }, take: MAX_CUSTOM_ENTRIES }),
      guideMetrics(),
    ]);
    const used = new Set<string>(GUIDE_CATEGORIES);
    for (const e of entries) if (e.category) used.add(e.category);
    return NextResponse.json({
      enabled: settings ? settings.guideEnabled : true,
      entries: entries.map((e) => ({
        id: e.id, question: e.question, answer: e.answer, links: sanitizeLinks(e.links), keywords: e.keywords, enabled: e.enabled,
        category: e.category, navHref: e.navHref, navLabel: e.navLabel, target: e.target, relatedQuestions: e.relatedQuestions, roles: e.roles,
        version: e.version, served: e.served, updatedAt: e.updatedAt,
      })),
      metrics,
      categories: [...used].sort(),
      limit: MAX_CUSTOM_ENTRIES,
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", guideEnabled: parsed.data.enabled },
      update: { guideEnabled: parsed.data.enabled },
      select: { guideEnabled: true },
    });
    return NextResponse.json({ enabled: settings.guideEnabled });
  });
}
