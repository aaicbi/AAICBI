import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedQuestion } from "@/lib/courseOwnership";
import { guardQuestionDeletable } from "@/lib/deletionGuards";
import { applyGate1Transition, applyGate2Transition } from "@/lib/questionBank/transitions";
import { embedTexts, embeddingSourceText, saveQuestionEmbedding } from "@/lib/embeddings";

const OptionUpdateSchema = z.object({
  id: z.string().optional(), // present = update existing, absent = new option
  text: z.string().min(1),
  isCorrect: z.boolean(),
});
const UpdateQuestionSchema = z.object({
  text: z.string().min(3).optional(),
  topic: z.string().nullable().optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  explanation: z.string().nullable().optional(),
  options: z.array(OptionUpdateSchema).min(2).max(6).optional(),
  approve: z.boolean().optional(), // shorthand for clearing needsReview after admin fixes it
});

async function currentBankStatus(id: string) {
  return (await prisma.question.findUnique({ where: { id }, select: { bankStatus: true } }))?.bankStatus ?? null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedQuestion(params.id, session.userId, session.role); // M11 audit finding — see courseOwnership.ts
    const body = await req.json();
    const parsed = UpdateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { options, approve, ...questionFields } = parsed.data;

    // An AI-generated bank question is approved by walking it through the bank's two gates, never by clearing its review
    // flag directly: that would put it in exams without the independent validation, while the bank, the studio and the
    // practice pools (which count only fully approved questions) would still see it as unapproved.
    let bankMove: { from: NonNullable<Awaited<ReturnType<typeof currentBankStatus>>>; to: "PENDING_VALIDATION" | "APPROVED" } | null = null;
    if (approve) {
      const current = await currentBankStatus(params.id);
      if (current && current !== "APPROVED") {
        if (session.role !== "SUPER_ADMIN") {
          return NextResponse.json({ error: "AI-generated bank questions are reviewed by a Super Admin on the Question bank page." }, { status: 403 });
        }
        const next = current === "PENDING_REVIEW" ? applyGate1Transition(current, "approve") : applyGate2Transition(current, "approve");
        if (!next) {
          const why = current === "PENDING_VALIDATION" || current === "VALIDATED_PASS" ? "It is waiting for validation. Run validation from the Question bank page, or ask Loop to." : "It was rejected, so it can't be approved.";
          return NextResponse.json({ error: why }, { status: 409 });
        }
        bankMove = { from: current, to: next as "PENDING_VALIDATION" | "APPROVED" };
      }
    }

    if (options) {
      if (!options.some((o) => o.isCorrect)) {
        return NextResponse.json({ error: "Mark exactly one option as correct." }, { status: 400 });
      }
      // Simplest correct approach: replace all options atomically rather
      // than diffing — question option sets are small (2-6) so this is
      // cheap, and it avoids subtle bugs from partial updates.
      await prisma.option.deleteMany({ where: { questionId: params.id } });
      await prisma.option.createMany({
        data: options.map((o, idx) => ({
          questionId: params.id,
          text: o.text,
          key: String.fromCharCode(65 + idx),
          isCorrect: o.isCorrect,
          order: idx,
        })),
      });
    }

    const question = await prisma.question.update({
      where: { id: params.id },
      data: {
        ...questionFields,
        ...(bankMove ? { bankStatus: bankMove.to } : {}),
        // A bank question keeps its review flag until it reaches APPROVED; any other question is approved by clearing it.
        ...(approve && (!bankMove || bankMove.to === "APPROVED") ? { needsReview: false, reviewReason: null } : {}),
      },
      include: { options: true },
    });
    if (bankMove) {
      await prisma.questionBankEvent.create({
        data: {
          questionId: params.id,
          fromStatus: bankMove.from,
          toStatus: bankMove.to,
          kind: bankMove.to === "APPROVED" ? "GATE2_APPROVED" : "GATE1_APPROVED",
          actedById: session.userId,
        },
      });
    }

    // M11 audit finding: editing a question's text or options never
    // recomputed its stored embedding, which meant a question's
    // duplicate-detection fingerprint could go stale the moment an
    // admin fixed a typo or reworded it — future imports would keep
    // comparing against the ORIGINAL wording. Only worth the extra
    // Voyage call when the content that actually feeds the embedding
    // changed; a `topic`/`difficulty`-only edit, or an `approve`
    // shorthand with no content change, leaves the embedding alone.
    // Deliberately doesn't re-run duplicate FLAGGING here (unlike the
    // import and manual-create paths) — an admin editing a question is
    // usually in the middle of resolving a review flag via `approve`,
    // and silently re-flagging it as a duplicate right after would
    // fight with that action's own meaning.
    if (options || questionFields.text) {
      const embedding = (
        await embedTexts([embeddingSourceText(question.text, question.options.map((o: { text: string }) => o.text))])
      )?.[0];
      if (embedding) {
        await saveQuestionEmbedding(question.id, embedding);
      }
    }

    return NextResponse.json(question);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedQuestion(params.id, session.userId, session.role); // M11 audit finding — see courseOwnership.ts
    await guardQuestionDeletable(params.id); // M11 audit finding — see deletionGuards.ts
    await prisma.question.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
