import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { UnansweredAction } from "@/lib/guide/adminSchemas";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/guide/unanswered/[id] — SUPER_ADMIN deals with a question
 * Loop could not answer: write the answer (it becomes a written answer for
 * everyone and the question is marked answered), dismiss it, or reopen a
 * dismissed one.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = UnansweredAction.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    const row = await prisma.guideUnanswered.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: "Question not found." }, { status: 404 });

    const a = parsed.data;
    if (a.action === "dismiss") {
      await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "DISMISSED" } });
      return NextResponse.json({ ok: true });
    }
    if (a.action === "reopen") {
      await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "OPEN" } });
      return NextResponse.json({ ok: true });
    }
    if ((await prisma.guideEntry.count()) >= MAX_CUSTOM_ENTRIES) {
      return NextResponse.json({ error: `You can keep up to ${MAX_CUSTOM_ENTRIES} written answers. Remove one first.` }, { status: 409 });
    }
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.guideEntry.create({
        data: { question: a.question, answer: a.answer, links: a.links as Prisma.InputJsonValue, keywords: a.keywords, enabled: a.enabled, createdById: session.userId },
      });
      await tx.guideUnanswered.update({ where: { id: row.id }, data: { status: "ANSWERED", entryId: created.id } });
      return created;
    });
    return NextResponse.json({ id: entry.id }, { status: 201 });
  });
}
