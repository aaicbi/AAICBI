import { prisma } from "@/lib/prisma";

/** The name shown for a course published by AAICBI itself rather than a training organization. */
export const PLATFORM_PUBLISHER = "AAICBI";

/**
 * Publisher name per course, in one query. A training organization's
 * courses are attributed to its dedicated staff user (see
 * trainingOrgStaff.ts), so the name is found by those user ids; every other
 * course belongs to AAICBI.
 */
export async function publisherNames(courses: { id: string; createdById: string }[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(courses.map((c) => c.createdById)));
  const orgs = ids.length ? await prisma.trainingOrganization.findMany({ where: { staffUserId: { in: ids } }, select: { staffUserId: true, name: true } }) : [];
  const byUser = new Map(orgs.map((o) => [o.staffUserId as string, o.name]));
  return new Map(courses.map((c) => [c.id, byUser.get(c.createdById) ?? PLATFORM_PUBLISHER]));
}
