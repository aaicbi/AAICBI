import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { sanitizeLinks } from "@/lib/guide/links";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

/**
 * GET/PUT /api/admin/guide — SUPER_ADMIN only. Loop's switch, the answers
 * written by hand, and the queue of questions Loop could not answer.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const [settings, entries, unanswered, answered, dismissed] = await Promise.all([
      prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } }),
      prisma.guideEntry.findMany({ orderBy: { createdAt: "desc" }, take: MAX_CUSTOM_ENTRIES }),
      prisma.guideUnanswered.findMany({ where: { status: "OPEN" }, orderBy: [{ asked: "desc" }, { lastAskedAt: "desc" }], take: 100 }),
      prisma.guideUnanswered.count({ where: { status: "ANSWERED" } }),
      prisma.guideUnanswered.count({ where: { status: "DISMISSED" } }),
    ]);
    return NextResponse.json({
      enabled: settings ? settings.guideEnabled : true,
      entries: entries.map((e) => ({ id: e.id, question: e.question, answer: e.answer, links: sanitizeLinks(e.links), keywords: e.keywords, enabled: e.enabled })),
      unanswered: unanswered.map((u) => ({ id: u.id, text: u.text, asked: u.asked, lastAskedAt: u.lastAskedAt })),
      counts: { answered, dismissed, limit: MAX_CUSTOM_ENTRIES },
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
