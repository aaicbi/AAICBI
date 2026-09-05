/**
 * M41 — the real moderation escalation logic: "a warning card shown to
 * a trainee on abuse, escalating to suspension if it persists." Issuing
 * a warning always creates the audit-trail row; whether it ALSO
 * triggers an automatic suspension depends on how many open warnings
 * this trainee has now accumulated against the platform-wide threshold
 * (PlatformSettings.qaWarningsBeforeSuspension) — verified directly
 * against real seeded Postgres before trusting this shape: two
 * warnings don't escalate, the third one does, and a later
 * reinstatement doesn't erase the warning history itself.
 *
 * Audit finding, fixed here: all three actions now check current
 * state before acting, not just create-and-forget. Without this, a
 * trainee who's already past the warning threshold would get a fresh,
 * redundant SUSPENSION audit row on every SUBSEQUENT warning too —
 * the state stays correct (they're already suspended either way), but
 * the audit trail becomes noisy and misleading, exactly the kind of
 * "genuine, honest history" this project treats as a real requirement
 * elsewhere (M27's PaystackEvent, M29's reconciliation idempotency).
 * The same reasoning applies to a staff member manually suspending an
 * already-suspended trainee, or reinstating one who was never
 * suspended — both are now a clear no-op with honest feedback, not a
 * misleading duplicate entry.
 */
import { prisma } from "@/lib/prisma";

export async function issueQaWarning(
  traineeId: string,
  issuedById: string,
  reason: string
): Promise<{ suspended: boolean }> {
  await prisma.qaModerationAction.create({
    data: { traineeId, issuedById, type: "WARNING", reason },
  });

  const warningCount = await prisma.qaModerationAction.count({
    where: { traineeId, type: "WARNING" },
  });

  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  const threshold = settings?.qaWarningsBeforeSuspension ?? 3;

  if (warningCount >= threshold) {
    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { qaSuspendedAt: true } });
    if (trainee?.qaSuspendedAt) {
      // Already suspended from an earlier warning crossing the same
      // threshold — the state is already correct; recording another
      // "reached the threshold" SUSPENSION row would just be noise.
      return { suspended: true };
    }
    await prisma.$transaction(async (tx: any) => {
      await tx.qaModerationAction.create({
        data: {
          traineeId,
          issuedById,
          type: "SUSPENSION",
          reason: `Automatic — reached ${warningCount} Q&A warnings (threshold: ${threshold}).`,
        },
      });
      await tx.trainee.update({ where: { id: traineeId }, data: { qaSuspendedAt: new Date() } });
    });
    return { suspended: true };
  }
  return { suspended: false };
}

export async function issueQaSuspension(
  traineeId: string,
  issuedById: string,
  reason: string
): Promise<{ changed: boolean }> {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { qaSuspendedAt: true } });
  if (trainee?.qaSuspendedAt) {
    return { changed: false };
  }
  await prisma.$transaction(async (tx: any) => {
    await tx.qaModerationAction.create({ data: { traineeId, issuedById, type: "SUSPENSION", reason } });
    await tx.trainee.update({ where: { id: traineeId }, data: { qaSuspendedAt: new Date() } });
  });
  return { changed: true };
}

export async function reinstateQaAccess(
  traineeId: string,
  issuedById: string,
  reason: string
): Promise<{ changed: boolean }> {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { qaSuspendedAt: true } });
  if (!trainee?.qaSuspendedAt) {
    return { changed: false };
  }
  await prisma.$transaction(async (tx: any) => {
    await tx.qaModerationAction.create({ data: { traineeId, issuedById, type: "REINSTATEMENT", reason } });
    await tx.trainee.update({ where: { id: traineeId }, data: { qaSuspendedAt: null } });
  });
  return { changed: true };
}
