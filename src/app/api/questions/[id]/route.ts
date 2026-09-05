import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedQuestion } from "@/lib/courseOwnership";
import { guardQuestionDeletable } from "@/lib/deletionGuards";
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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedQuestion(params.id, session.userId); // M11 audit finding — see courseOwnership.ts
    const body = await req.json();
    const parsed = UpdateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { options, approve, ...questionFields } = parsed.data;

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
        ...(approve ? { needsReview: false, reviewReason: null } : {}),
      },
      include: { options: true },
    });

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
    await requireOwnedQuestion(params.id, session.userId); // M11 audit finding — see courseOwnership.ts
    await guardQuestionDeletable(params.id); // M11 audit finding — see deletionGuards.ts
    await prisma.question.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
