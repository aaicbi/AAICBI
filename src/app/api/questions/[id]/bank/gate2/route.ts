import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { embedTexts, embeddingSourceText, saveQuestionEmbedding } from "@/lib/embeddings";
import { applyGate2Transition } from "@/lib/questionBank/transitions";

/**
 * POST /api/questions/[id]/bank/gate2 — the second human checkpoint,
 * for questions independent validation flagged (WARNING/FLAGGED/
 * REJECTED). Same structure and "no ownership check" reasoning as
 * gate1's own route. Approving here is the one point besides gate 1's
 * own approval where needsReview actually needs to be cleared by hand
 * — a clean VALIDATED_PASS already auto-clears it in
 * validateBankQuestions.ts, but these three statuses still have it
 * set until a human explicitly clears it here.
 */
const OptionEditSchema = z.object({ text: z.string().min(1), isCorrect: z.boolean() });
const Gate2Schema = z.object({
  action: z.enum(["approve", "reject"]),
  editedText: z.string().min(3).optional(),
  editedOptions: z.array(OptionEditSchema).min(2).max(6).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`bank-gate2:${session.userId}:${clientIp(req)}`, 60, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many review actions in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = Gate2Schema.safeParse(body);
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

    const nextStatus = applyGate2Transition(question.bankStatus, parsed.data.action);
    if (!nextStatus) {
      return NextResponse.json({ error: "This question isn't awaiting second review." }, { status: 409 });
    }

    if (parsed.data.editedOptions) {
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
      data: {
        bankStatus: nextStatus,
        ...(parsed.data.editedText ? { text: parsed.data.editedText } : {}),
        ...(nextStatus === "APPROVED" ? { needsReview: false, reviewReason: null } : {}),
      },
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
        kind: parsed.data.action === "approve" ? "GATE2_APPROVED" : "GATE2_REJECTED",
        actedById: session.userId,
      },
    });

    return NextResponse.json(updated);
  });
}
