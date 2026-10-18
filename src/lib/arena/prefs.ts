/** Ayakbi Arena personal settings with the database. Muting only quiets phone alerts for new challenges; nothing is hidden in the app. */
import { prisma } from "@/lib/prisma";
import { isMuted, muteFor, type MuteChoice } from "@/lib/arena/prefsCore";

export async function challengeAlertsMuted(traineeId: string): Promise<boolean> {
  return isMuted(await prisma.arenaPreference.findUnique({ where: { traineeId } }));
}

export async function prefsOf(traineeId: string) {
  const p = await prisma.arenaPreference.findUnique({ where: { traineeId } });
  const muted = isMuted(p);
  return { challengeMuted: muted, until: muted && p?.challengeMutedUntil ? p.challengeMutedUntil.getTime() : null, forever: !!p?.challengeMuted };
}

export async function setChallengeMute(traineeId: string, choice: MuteChoice) {
  const data = muteFor(choice);
  await prisma.arenaPreference.upsert({ where: { traineeId }, create: { traineeId, ...data }, update: data });
  return prefsOf(traineeId);
}
