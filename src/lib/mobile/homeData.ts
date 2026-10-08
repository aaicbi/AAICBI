import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { listUpcomingEvents } from "@/lib/ecosystem/events";
import { openJobWhere } from "@/lib/landing/publicWhere";
import { eventWhen, type MobileBlock } from "@/lib/mobile/homeCore";

/** The next public event, if the events pages are switched on and one is coming up. */
export async function nextEventBlock(): Promise<MobileBlock | null> {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) return null;
  const [event] = await listUpcomingEvents({ take: 1 }).catch(() => []);
  if (!event) return null;
  return { kind: "event", title: event.title, when: eventWhen(event.startsAt), where: event.locationText, by: event.organizationName, href: "/events" };
}

/** Up to three open jobs, if the public job board is switched on. */
export async function opportunitiesBlock(seeAllHref = "/jobs"): Promise<MobileBlock | null> {
  const flags = await getEcosystemFlags();
  if (!flags.publicJobs) return null;
  const jobs = await prisma.jobPosting
    .findMany({ where: openJobWhere(), orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, employer: { select: { companyName: true } } } })
    .catch(() => []);
  if (jobs.length === 0) return null;
  return { kind: "opportunities", items: jobs.map((j) => ({ title: j.title, by: j.employer.companyName, href: `/jobs/${j.id}` })), seeAllHref };
}
