import { prisma } from "@/lib/prisma";

const DAY = 24 * 3600 * 1000;

export interface EventCard {
  id: string; title: string; description: string | null; startsAt: Date; endsAt: Date | null;
  locationText: string | null; registrationUrl: string | null; organizationName: string; organizationSlug: string;
}

/**
 * Published events of organizations with a public page that are not over
 * yet (an event with no end time stays listed for the day it starts).
 * Over-fetches slightly and filters in code so the "not over" rule lives
 * in one place (isUpcoming's definition).
 */
export async function listUpcomingEvents(opts: { organizationId?: string; q?: string; take?: number } = {}): Promise<EventCard[]> {
  const now = new Date();
  const q = opts.q?.trim();
  const rows = await prisma.organizationEvent.findMany({
    where: {
      status: "PUBLISHED",
      startsAt: { gte: new Date(now.getTime() - 60 * DAY) },
      trainingOrganization: { approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } }, ...(opts.organizationId ? { id: opts.organizationId } : {}) },
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { locationText: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    select: {
      id: true, title: true, description: true, startsAt: true, endsAt: true, locationText: true, registrationUrl: true,
      trainingOrganization: { select: { name: true, publicProfile: { select: { slug: true } } } },
    },
  });
  return rows
    .filter((e) => (e.endsAt ?? new Date(e.startsAt.getTime() + DAY)).getTime() >= now.getTime())
    .slice(0, opts.take ?? 30)
    .map((e) => ({
      id: e.id, title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, locationText: e.locationText,
      registrationUrl: e.registrationUrl, organizationName: e.trainingOrganization.name, organizationSlug: e.trainingOrganization.publicProfile?.slug ?? "",
    }));
}
