import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam } from "@/lib/courseOwnership";
import { findDuplicatesForBatch, saveQuestionEmbedding } from "@/lib/embeddings";

const OptionSchema = z.object({ text: z.string().min(1), isCorrect: z.boolean() });
const CreateQuestionSchema = z.object({
  text: z.string().min(3),
  topic: z.string().optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  explanation: z.string().optional(),
  options: z.array(OptionSchema).min(2).max(6),
});

// Bulk counterpart to DELETE /api/questions/[id]. Capped higher than
// gate1-bulk's 50 (a different, AI-workflow-scoped action) — 200 is
// generous enough for a "select all" even on the largest realistic
// DOCX import, while still bounding a single request's work.
const BulkDeleteSchema = z.object({ questionIds: z.array(z.string()).min(1).max(200) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedExam(params.id, session.userId); // M11 audit finding — see courseOwnership.ts
    const body = await req.json();
    const parsed = CreateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    if (!parsed.data.options.some((o) => o.isCorrect)) {
      return NextResponse.json({ error: "Mark exactly one option as correct." }, { status: 400 });
    }

    const existingCount = await prisma.question.count({ where: { examId: params.id } });

    // M11 audit finding: duplicate detection previously only ever ran
    // on the DOCX-import path, which meant a hand-authored question
    // (created here) was invisible to it in both directions — it
    // could never itself be flagged as a duplicate, AND, more
    // importantly, it never got an embedding stored at all, so a
    // LATER DOCX import could never detect that it was duplicating
    // this hand-authored question either. Running the same batched
    // duplicate check here (with a batch of one) closes both gaps
    // with the code that already exists for imports, rather than a
    // separate parallel path. Same graceful-degradation behavior:
    // skipped silently if VOYAGE_API_KEY isn't set.
    const { embeddings, matches } = await findDuplicatesForBatch(params.id, [
      { questionText: parsed.data.text, optionTexts: parsed.data.options.map((o) => o.text) },
    ]);
    const dup = matches[0];
    const needsReview = !!dup; // manually authored and not a likely duplicate — admin already confirmed the answer
    const reviewReason = dup
      ? `Possible duplicate (${Math.round(dup.similarity * 100)}% similar) of an existing question: "${dup.matchedQuestionText.slice(0, 120)}"`
      : null;

    const question = await prisma.question.create({
      data: {
        examId: params.id,
        text: parsed.data.text,
        topic: parsed.data.topic,
        difficulty: parsed.data.difficulty ?? "BEGINNER",
        explanation: parsed.data.explanation,
        order: existingCount,
        needsReview,
        reviewReason,
        options: {
          create: parsed.data.options.map((o, idx) => ({
            text: o.text,
            key: String.fromCharCode(65 + idx),
            isCorrect: o.isCorrect,
            order: idx,
          })),
        },
      },
      include: { options: true },
    });

    const embedding = embeddings[0];
    if (embedding) {
      await saveQuestionEmbedding(question.id, embedding);
    }

    return NextResponse.json(question, { status: 201 });
  });
}

/**
 * DELETE /api/exams/[id]/questions — bulk delete, scoped to this exam
 * the same way gate1-bulk scopes to examId: an id in the request body
 * can only ever be acted on if it genuinely belongs to this exam. One
 * route serves a module assessment, a standalone exam, and a course
 * examination alike — all three are just an Exam row (see the model's
 * own schema comment), so nothing exam-type-specific is needed here.
 *
 * Deliberately not a single all-or-nothing transaction: unlike DELETE
 * /api/questions/[id] (which throws via guardQuestionDeletable so one
 * bad id fails the whole request), a multi-select "delete these" click
 * should delete everything it safely can and report back exactly what
 * it skipped and why — a batch of 30 shouldn't fail entirely because
 * one of them already has a trainee answer recorded against it.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedExam(params.id, session.userId); // M11 audit finding — see courseOwnership.ts

    const body = await req.json().catch(() => null);
    const parsed = BulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A list of question ids is required." }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: parsed.data.questionIds }, examId: params.id },
      select: { id: true },
    });
    const foundIds = new Set(questions.map((q) => q.id));
    const notFoundIds = parsed.data.questionIds.filter((id) => !foundIds.has(id));

    // Same rule as guardQuestionDeletable, applied to the whole batch
    // in one query instead of one round trip per id.
    const answerCounts = await prisma.answer.groupBy({
      by: ["questionId"],
      where: { questionId: { in: Array.from(foundIds) } },
      _count: { _all: true },
    });
    const protectedIds = new Set(answerCounts.map((a) => a.questionId));

    const deletableIds = Array.from(foundIds).filter((id) => !protectedIds.has(id));
    const result = deletableIds.length > 0 ? await prisma.question.deleteMany({ where: { id: { in: deletableIds } } }) : { count: 0 };

    const skipped = [
      ...notFoundIds.map((id) => ({ id, reason: "Not part of this assessment." })),
      ...Array.from(protectedIds).map((id) => ({
        id,
        reason: "Already has trainee answers recorded — edit it instead of deleting it.",
      })),
    ];

    return NextResponse.json({ deleted: result.count, skipped });
  });
}
