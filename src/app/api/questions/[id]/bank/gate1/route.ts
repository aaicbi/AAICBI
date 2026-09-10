import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { embedTexts, embeddingSourceText, saveQuestionEmbedding } from "@/lib/embeddings";
import { applyGate1Transition } from "@/lib/questionBank/transitions";

/**
 * POST /api/questions/[id]/bank/gate1 — the first human checkpoint, a
 * plain in-app action (NOT Loop-mediated at all, per the plan's own
 * explicit instruction), modeled on PUT /api/questions/[id]'s existing
 * option-replace + embedding-recompute logic. Deliberately its own
 * route rather than reusing that one directly: this one manages
 * bankStatus and writes the QuestionBankEvent audit trail, which the
 * generic question routes correctly know nothing about — and it
 * intentionally has NO requireOwnedQuestion call, per the confirmed
 * decision that Loop's question-bank actions extend Loop's existing
 * platform-wide reach rather than this app's otherwise-strict
 * no-SUPER_ADMIN-bypass-on-mutations rule.
 */
const OptionEditSchema = z.object({ text: z.string().min(1), isCorrect: z.boolean() });
const Gate1Schema = z.object({
  action: z.enum(["approve", "reject"]),
  editedText: z.string().min(3).optional(),
  editedOptions: z.array(OptionEditSchema).min(2).max(6).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`bank-gate1:${session.userId}:${clientIp(req)}`, 60, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many review actions in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = Gate1Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid action is required." }, { status: 400 });
    }
    if (parsed.data.editedOptions && !parsed.data.editedOptions.some((o) => o.isCorrect)) {
      return NextResponse.json({ error: "Mark exactly one option as correct." }, { status: 400 });
    }

    const question = await prisma.question.findUnique({ where: { id: params.id }, select: { id: true, bankStatus: true } });
    if (!question) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const nextStatus = applyGate1Transition(question.bankStatus, parsed.data.action);
    if (!nextStatus) {
      return NextResponse.json({ error: "This question isn't awaiting first review." }, { status: 409 });
    }

    if (parsed.data.editedOptions) {
      // Same "replace all options atomically" approach as
      // PUT /api/questions/[id] — question option sets are small
      // (2-6), so this is cheap and avoids subtle partial-update bugs.
      await prisma.option.deleteMany({ where: { questionId: params.id } });
      await prisma.option.createMany({
        data: parsed.data.editedOptions.map((o, idx) => ({
          questionId: params.id,
          text: o.text,
          key: String.fromCharCode(65 + idx),
          isCorrect: o.isCorrect,
          order: idx,
        })),
      });
    }

    const updated = await prisma.question.update({
      where: { id: params.id },
      data: { bankStatus: nextStatus, ...(parsed.data.editedText ? { text: parsed.data.editedText } : {}) },
      include: { options: true },
    });

    if (parsed.data.editedOptions || parsed.data.editedText) {
      const embedding = (await embedTexts([embeddingSourceText(updated.text, updated.options.map((o) => o.text))]))?.[0];
      if (embedding) await saveQuestionEmbedding(updated.id, embedding);
    }

    await prisma.questionBankEvent.create({
      data: {
        questionId: params.id,
        fromStatus: question.bankStatus,
        toStatus: nextStatus,
        kind: parsed.data.action === "approve" ? "GATE1_APPROVED" : "GATE1_REJECTED",
        actedById: session.userId,
      },
    });

    return NextResponse.json(updated);
  });
}
