/**
 * In-app messaging — SUPER_ADMIN-issued suspend/reinstate, mirroring
 * src/lib/qaModeration.ts's issueQaSuspension/reinstateQaAccess exactly
 * (including the "check current state before acting" discipline, so a
 * staff member suspending an already-suspended trainee — or Loop's
 * propose_messaging_suspension tool being confirmed twice — is a clean
 * no-op, not a misleading duplicate audit row). No warning-escalation
 * step here, unlike qaModeration.ts's issueQaWarning — not requested for
 * this feature, which only ever suspends/reinstates directly.
 */
import { prisma } from "@/lib/prisma";

export async function issueMessagingSuspension(traineeId: string, issuedById: string, reason: string): Promise<{ changed: boolean }> {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { messagingSuspendedAt: true } });
  if (trainee?.messagingSuspendedAt) {
    return { changed: false };
  }
  await prisma.$transaction(async (tx) => {
    await tx.messagingModerationAction.create({ data: { traineeId, issuedById, type: "SUSPENSION", reason } });
    await tx.trainee.update({ where: { id: traineeId }, data: { messagingSuspendedAt: new Date() } });
  });
  return { changed: true };
}

export async function reinstateMessagingAccess(traineeId: string, issuedById: string, reason: string): Promise<{ changed: boolean }> {
  const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { messagingSuspendedAt: true } });
  if (!trainee?.messagingSuspendedAt) {
    return { changed: false };
  }
  await prisma.$transaction(async (tx) => {
    await tx.messagingModerationAction.create({ data: { traineeId, issuedById, type: "REINSTATEMENT", reason } });
    await tx.trainee.update({ where: { id: traineeId }, data: { messagingSuspendedAt: null } });
  });
  return { changed: true };
}
