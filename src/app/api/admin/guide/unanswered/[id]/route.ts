import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { UnansweredAction } from "@/lib/guide/adminSchemas";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";
import { createEntry, guideActor } from "@/lib/guide/knowledge";
import { addVariant } from "@/lib/guide/similarity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/guide/unanswered/[id] — SUPER_ADMIN deals with a question
 * Loop could not answer:
 *   answer     write the answer; it is approved into the knowledge for everyone
 *   review     take it into review
 *   reject     not something the guide should answer (kept, with the reason)
 *   merge      it is the same as another question or an existing answer
 *   resolve    handled another way (for example the page was fixed)
 *   categorize set its category
 *   dismiss / reopen
 * Every decision records who made it and when.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = UnansweredAction.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    const row = await prisma.guideUnanswered.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    const a = parsed.data;
    const decided = { reviewedAt: new Date(), reviewedById: actor.userId };

    switch (a.action) {
      case "review":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "IN_REVIEW", reviewedById: actor.userId } });
        return NextResponse.json({ ok: true });
      case "reject":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "REJECTED", reviewNote: a.note ?? null, ...decided } });
        return NextResponse.json({ ok: true });
      case "resolve":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "ANSWERED", reviewNote: a.note ?? "Resolved without a written answer.", ...decided } });
        return NextResponse.json({ ok: true });
      case "dismiss":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "DISMISSED", ...decided } });
        return NextResponse.json({ ok: true });
      case "reopen":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "OPEN", reviewedAt: null } });
        return NextResponse.json({ ok: true });
      case "categorize":
        await prisma.guideUnanswered.update({ where: { id: row.id }, data: { category: a.category || null } });
        return NextResponse.json({ ok: true });
      case "merge": {
        if (a.intoQuestionId) {
          if (a.intoQuestionId === row.id) return NextResponse.json({ error: "A question cannot be merged into itself." }, { status: 400 });
          const target = await prisma.guideUnanswered.findUnique({ where: { id: a.intoQuestionId } });
          if (!target) return NextResponse.json({ error: "The question to merge into was not found." }, { status: 404 });
          let variants = addVariant(target.variants, row.text, target.text);
          for (const v of row.variants) variants = addVariant(variants, v, target.text);
          const counts: Record<string, number> = { ...(target.roleCounts as Record<string, number>) };
          for (const [k, n] of Object.entries(row.roleCounts as Record<string, number>)) counts[k] = (counts[k] ?? 0) + n;
          await prisma.$transaction([
            prisma.guideUnanswered.update({ where: { id: target.id }, data: { asked: { increment: row.asked }, variants, roleCounts: counts } }),
            prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "MERGED", mergedIntoId: target.id, ...decided } }),
          ]);
          return NextResponse.json({ ok: true });
        }
        const entry = await prisma.guideEntry.findUnique({ where: { id: a.intoEntryId! }, select: { id: true, relatedQuestions: true, question: true } });
        if (!entry) return NextResponse.json({ error: "The answer to merge into was not found." }, { status: 404 });
        const related = [row.text, ...row.variants].filter((t) => t !== entry.question).reduce((list, t) => (list.includes(t) ? list : [...list, t]), entry.relatedQuestions).slice(0, 8);
        await prisma.$transaction([
          prisma.guideEntry.update({ where: { id: entry.id }, data: { relatedQuestions: related } }),
          prisma.guideUnanswered.update({ where: { id: row.id }, data: { status: "ANSWERED", entryId: entry.id, mergedIntoId: null, reviewNote: "Merged into an existing answer: its wording now helps find that answer.", ...decided } }),
        ]);
        return NextResponse.json({ ok: true });
      }
      case "answer": {
        if ((await prisma.guideEntry.count()) >= MAX_CUSTOM_ENTRIES) {
          return NextResponse.json({ error: `You can keep up to ${MAX_CUSTOM_ENTRIES} written answers. Remove one first.` }, { status: 409 });
        }
        // The other ways this was worded help the answer be found next time.
        const related = [...a.relatedQuestions, ...row.variants.filter((v) => v !== a.question && !a.relatedQuestions.includes(v))].slice(0, 8);
        const entry = await prisma.$transaction(async (tx) => {
          const created = await createEntry(tx, { ...a, relatedQuestions: related, category: a.category ?? row.category }, actor);
          await tx.guideUnanswered.update({ where: { id: row.id }, data: { status: "ANSWERED", entryId: created.id, ...decided } });
          return created;
        });
        return NextResponse.json({ id: entry.id }, { status: 201 });
      }
    }
  });
}
