import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { applyGate1Transition } from "@/lib/questionBank/transitions";

/**
 * POST /api/exams/[id]/bank/gate1-bulk — "approve all" for gate 1, the
 * bulk counterpart to the per-question gate1 route. `examId` scoping
 * (not just trusting the id list alone) is deliberate defense in
 * depth: a question id in the request body can only ever be acted on
 * if it genuinely belongs to the exam named in the URL.
 */
const BulkSchema = z.object({ questionIds: z.array(z.string()).min(1).max(50) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`bank-gate1-bulk:${session.userId}:${clientIp(req)}`, 20, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many bulk actions in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A list of question ids is required." }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: parsed.data.questionIds }, examId: params.id },
      select: { id: true, bankStatus: true },
    });

    let approved = 0;
    let skipped = 0;
    for (const q of questions) {
      const nextStatus = applyGate1Transition(q.bankStatus, "approve");
      if (!nextStatus) {
        skipped++;
        continue;
      }
      await prisma.question.update({ where: { id: q.id }, data: { bankStatus: nextStatus } });
      await prisma.questionBankEvent.create({
        data: { questionId: q.id, fromStatus: q.bankStatus, toStatus: nextStatus, kind: "GATE1_APPROVED", actedById: session.userId },
      });
      approved++;
    }

    return NextResponse.json({ approved, skipped });
  });
}
