import { prisma } from "@/lib/prisma";

/**
 * An organization has one picture, shown on its public page, its profile, search and the feed (`logoUrl`), and as the profile picture
 * of the account everyone in the organization signs in through (the shared internal user's `avatarUrl`). They are kept the same, so
 * the picture a person uploads as their profile picture is also the one visitors see, and the other way round.
 * Returns the addresses that were replaced so the caller can delete the old files.
 */
export async function setOrganizationPicture(orgId: string, staffUserId: string, url: string | null): Promise<string[]> {
  const [org, user] = await Promise.all([
    prisma.trainingOrganization.findUnique({ where: { id: orgId }, select: { logoUrl: true } }),
    prisma.user.findUnique({ where: { id: staffUserId }, select: { avatarUrl: true } }),
  ]);
  await prisma.$transaction([
    prisma.trainingOrganization.update({ where: { id: orgId }, data: { logoUrl: url } }),
    prisma.user.update({ where: { id: staffUserId }, data: { avatarUrl: url } }),
  ]);
  const old = new Set([org?.logoUrl, user?.avatarUrl].filter((u): u is string => !!u && u !== url));
  return [...old];
}
