/**
 * Ayakbi Arena: the credit wallet. Credits are earned in the arena (Fastest Fingers today), kept as a ledger, and can be sent to a
 * coursemate. `spendCredits` is the one place credits leave a wallet for a platform feature; nothing calls it yet. The whole wallet is
 * behind a Super Admin switch that is off until the features to buy are ready.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension } from "@/lib/arena/suspension";
import { creditsOf } from "@/lib/arena/credits";
import { sendPushForNotification } from "@/lib/push/send";
import { checkTransfer, MAX_TRANSFER, MAX_SENT_PER_DAY, REASON_LABEL } from "@/lib/arena/walletCore";

async function requireWallet(courseId: string) {
  if (!(await availabilityForCourse(courseId)).wallet) throw new ArenaError("Credits can't be sent or spent yet. This opens when the platform is ready for it.", 403);
}

const startOfDay = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };

export async function walletView(traineeId: string, courseId: string) {
  const avail = await availabilityForCourse(courseId);
  if (!(await isEnrolled(traineeId, courseId))) throw new ArenaError("The wallet is for trainees enrolled in this course.", 403);
  const [balance, sentRows, history, mates] = await Promise.all([
    creditsOf(traineeId),
    prisma.arenaCredit.aggregate({ where: { traineeId, reason: "TRANSFER_OUT", createdAt: { gte: startOfDay() } }, _sum: { points: true } }),
    prisma.arenaCredit.findMany({ where: { traineeId }, orderBy: { createdAt: "desc" }, take: 15 }),
    avail.wallet ? prisma.courseEnrollment.findMany({ where: { courseId, traineeId: { not: traineeId }, unlockedAt: { not: null }, accessRevokedAt: null }, select: { trainee: { select: { id: true, name: true } } }, take: 200 }) : [],
  ]);
  return {
    enabled: avail.wallet,
    balance,
    maxTransfer: MAX_TRANSFER,
    sentToday: -(sentRows._sum.points ?? 0),
    maxPerDay: MAX_SENT_PER_DAY,
    history: history.map((h) => ({ id: h.id, points: h.points, label: h.note ?? REASON_LABEL[h.reason] ?? h.reason, at: h.createdAt.getTime() })),
    mates: mates.map((m) => m.trainee).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Runs `fn` while holding a lock on this trainee's wallet, so two requests at once can never spend the same credits twice. */
async function withWalletLock<T>(traineeId: string, fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"arena-wallet:" + traineeId}))`;
    return fn(tx);
  });
}

export async function transferCredits(input: { fromId: string; toId: string; courseId: string; amount: unknown }): Promise<{ amount: number; balance: number }> {
  const { fromId, toId, courseId } = input;
  await requireWallet(courseId);
  if (!(await isEnrolled(fromId, courseId))) throw new ArenaError("The wallet is for trainees enrolled in this course.", 403);
  if (fromId !== toId && !(await isEnrolled(toId, courseId))) throw new ArenaError("You can send credits to coursemates in this course.", 404);
  if (await activeSuspension(fromId, courseId)) throw new ArenaError("You can't send credits while you are suspended from the arena.", 403);
  if (await activeSuspension(toId, courseId)) throw new ArenaError("That person can't receive credits right now.", 409);
  const [from, to] = await Promise.all([prisma.trainee.findUnique({ where: { id: fromId }, select: { name: true } }), prisma.trainee.findUnique({ where: { id: toId }, select: { name: true } })]);
  const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const result = await withWalletLock(fromId, async (tx) => {
    const [bal, sent] = await Promise.all([
      tx.arenaCredit.aggregate({ where: { traineeId: fromId }, _sum: { points: true } }),
      tx.arenaCredit.aggregate({ where: { traineeId: fromId, reason: "TRANSFER_OUT", createdAt: { gte: startOfDay() } }, _sum: { points: true } }),
    ]);
    const balance = bal._sum.points ?? 0;
    const verdict = checkTransfer({ amount: input.amount, balance, sentToday: -(sent._sum.points ?? 0), fromId, toId });
    if (!verdict.ok) throw new ArenaError(verdict.error, 400);
    await tx.arenaCredit.create({ data: { traineeId: fromId, courseId, points: -verdict.amount, reason: "TRANSFER_OUT", refId: id, note: `Sent to ${to?.name ?? "a coursemate"}` } });
    await tx.arenaCredit.create({ data: { traineeId: toId, courseId, points: verdict.amount, reason: "TRANSFER_IN", refId: id, note: `Received from ${from?.name ?? "a coursemate"}` } });
    return { amount: verdict.amount, balance: balance - verdict.amount };
  });
  try {
    const note = { type: "ARENA_CREDITS", title: `${(from?.name ?? "A coursemate").split(" ")[0]} sent you ${result.amount} credit${result.amount === 1 ? "" : "s"}`, body: "Find them in your Ayakbi Arena wallet.", url: `/trainee/arena/${courseId}/chat` };
    await prisma.userNotification.create({ data: { recipientType: "TRAINEE", recipientId: toId, ...note } });
    await sendPushForNotification("TRAINEE", toId, note);
  } catch (e) { console.error("Credit notification failed:", e); }
  return result;
}

/**
 * Takes credits out of a wallet for something bought on the platform. Not used by any feature yet; the wallet switch has to be on.
 * `refId` identifies the purchase, so asking twice for the same purchase charges once.
 */
export async function spendCredits(input: { traineeId: string; courseId: string; amount: number; reason: string; refId: string; note?: string }): Promise<{ balance: number }> {
  await requireWallet(input.courseId);
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new ArenaError("Choose a whole number of credits, at least 1.");
  return withWalletLock(input.traineeId, async (tx) => {
    const dup = await tx.arenaCredit.findFirst({ where: { traineeId: input.traineeId, reason: `SPEND:${input.reason}`, refId: input.refId } });
    const bal = (await tx.arenaCredit.aggregate({ where: { traineeId: input.traineeId }, _sum: { points: true } }))._sum.points ?? 0;
    if (dup) return { balance: bal };
    if (input.amount > bal) throw new ArenaError("You don't have enough credits for that.", 400);
    await tx.arenaCredit.create({ data: { traineeId: input.traineeId, courseId: input.courseId, points: -input.amount, reason: `SPEND:${input.reason}`, refId: input.refId, note: input.note } });
    return { balance: bal - input.amount };
  });
}
