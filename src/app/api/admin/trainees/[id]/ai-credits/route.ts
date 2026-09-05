import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * M45 — the "admin adjusts a trainee's balance directly" half of the
 * roadmap's explicit for-now decision (real self-service purchasing is
 * its own later phase). Genuinely real, working logic — not blocked on
 * Session 2's actual AI feature existing, since granting/adjusting a
 * balance is meaningful on its own regardless of what spends it later.
 *
 * Honest gap worth stating plainly: there is no admin-facing trainee
 * detail or management page anywhere in this app yet to actually call
 * this route from — not something M45 created, a pre-existing absence
 * in the whole project. This is the real backend logic, built and
 * correct, waiting for a page that doesn't exist yet to use it.
 */
const AdjustCreditsSchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, "Amount can't be zero — that wouldn't be a real adjustment."),
  reason: z.string().min(1, "A reason is required — this is a real, audited ledger, not an unexplained number change."),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = AdjustCreditsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    // Audit finding, fixed before it could cause real damage: the
    // previous version of this route read the current balance, computed
    // the result, checked it, then wrote it back — three separate
    // steps, and the comment here claimed Prisma's transaction
    // isolation made that safe against a race. That claim was wrong.
    // Postgres's default isolation level is Read Committed, not
    // Serializable — two concurrent adjustments could both read the
    // same starting balance before either commits, both independently
    // pass the floor check, and the second write would silently
    // overwrite the first's result, potentially letting the balance go
    // negative despite the check, or losing one adjustment entirely.
    //
    // Fixed with a single atomic conditional UPDATE instead — the WHERE
    // clause enforces the floor check as part of the exact same
    // statement that applies the change, not a separate step. Postgres
    // takes a row lock during an UPDATE, so two concurrent attempts on
    // the same trainee are genuinely serialized: the second one's WHERE
    // clause is evaluated against the first's already-committed result,
    // not stale data. `updateMany` (not `update`) because the WHERE
    // clause needs to include the balance condition, which `update`'s
    // unique-only where doesn't support.
    const result = await prisma.$transaction(async (tx: any) => {
      const applied = await tx.trainee.updateMany({
        where: { id: params.id, aiCreditBalance: { gte: -parsed.data.amount } },
        data: { aiCreditBalance: { increment: parsed.data.amount } },
      });
      if (applied.count === 0) {
        const current = await tx.trainee.findUniqueOrThrow({ where: { id: params.id }, select: { aiCreditBalance: true } });
        const err = new Error(
          `This adjustment would take the balance below zero (currently ${current.aiCreditBalance}). A balance can't go negative — it's not a debt, it's how many credits are left to spend.`
        ) as Error & { status?: number };
        err.status = 400;
        throw err;
      }

      await tx.aiCreditGrant.create({
        data: {
          traineeId: params.id,
          amount: parsed.data.amount,
          grantedById: session.userId,
          reason: parsed.data.reason,
        },
      });
      return tx.trainee.findUniqueOrThrow({ where: { id: params.id }, select: { aiCreditBalance: true } });
    });

    return NextResponse.json(result);
  });
}
