/**
 * Ayakbi Arena: credit scores. A trainee earns credits in a course's arena (today: winning Fastest Fingers). They are kept as a ledger,
 * one row per award, so a total is a sum and an award can be traced to what earned it. Credits are not spent anywhere yet.
 */
import { prisma } from "@/lib/prisma";

export async function creditsOf(traineeId: string, courseId?: string): Promise<number> {
  const r = await prisma.arenaCredit.aggregate({ where: { traineeId, ...(courseId ? { courseId } : {}) }, _sum: { points: true } });
  return r._sum.points ?? 0;
}

/** Awards credits once per (trainee, reason, ref): asking again for the same thing changes nothing. */
export async function awardCredits(input: { traineeId: string; courseId: string; points: number; reason: string; refId: string; note?: string }): Promise<boolean> {
  try {
    await prisma.arenaCredit.create({ data: input });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
}
