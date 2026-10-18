import { prisma } from "@/lib/prisma";

/** A player's current suspension in a course's arena (not lifted, not expired), if any. */
export async function activeSuspension(traineeId: string, courseId: string): Promise<{ id: string; reason: string | null; expiresAt: Date | null } | null> {
  const row = await prisma.arenaSuspension.findFirst({
    where: { traineeId, courseId, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, expiresAt: true },
  });
  return row;
}

export function suspensionText(s: { expiresAt: Date | null }): string {
  return s.expiresAt ? `You are suspended from this arena until ${s.expiresAt.toUTCString().replace(/ GMT$/, " UTC")}.` : "You are suspended from this arena until a moderator lifts it.";
}
