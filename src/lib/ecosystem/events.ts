import { prisma } from "@/lib/prisma";
import { publicWhere } from "@/lib/events/events";
import { getEventSettings } from "@/lib/events/eventsAccess";

export interface EventCard {
  id: string; title: string; description: string | null; startsAt: Date; endsAt: Date | null; timeZone: string; delivery: "PHYSICAL" | "ONLINE" | "HYBRID";
  locationText: string | null; registrationUrl: string | null; organizationName: string; organizationSlug: string; flyerUrl: string | null;
}

/**
 * Published public events that are not over yet, from the Event Manager. These are the only events the public pages, the landing page,
 * search and the mobile home ever list: an event appears here only after it was published (and, for an organisation, approved).
 * Private joining details are never part of this.
 */
export async function listUpcomingEvents(opts: { organizationId?: string; q?: string; take?: number } = {}): Promise<EventCard[]> {
  if (!(await getEventSettings()).enabled) return [];
  const now = new Date();
  const q = opts.q?.trim().slice(0, 80);
  const rows = await prisma.event.findMany({
    where: {
      AND: [
        publicWhere(now), { endsAt: { gt: now } },
        ...(opts.organizationId ? [{ trainingOrganizationId: opts.organizationId }] : []),
        ...(q ? [{ OR: [{ title: { contains: q, mode: "insensitive" as const } }, { summary: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }, { venueName: { contains: q, mode: "insensitive" as const } }, { city: { contains: q, mode: "insensitive" as const } }] }] : []),
      ],
    },
    orderBy: { startsAt: "asc" },
    take: Math.min(opts.take ?? 30, 200),
    select: {
      id: true, title: true, summary: true, description: true, startsAt: true, endsAt: true, timeZone: true, delivery: true, venueName: true, city: true, registrationUrl: true, flyerUrl: true,
      trainingOrganization: { select: { name: true, publicProfile: { select: { slug: true } } } },
    },
  });
  return rows.map((e) => ({
    id: e.id, title: e.title, description: e.summary ?? e.description, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, delivery: e.delivery,
    locationText: e.delivery === "ONLINE" ? "Online" : [e.venueName, e.city].filter(Boolean).join(", ") || (e.delivery === "HYBRID" ? "Hybrid" : null),
    registrationUrl: e.registrationUrl, organizationName: e.trainingOrganization?.name ?? "AAICBI", organizationSlug: e.trainingOrganization?.publicProfile?.slug ?? "", flyerUrl: e.flyerUrl,
  }));
}
