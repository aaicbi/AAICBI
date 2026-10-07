import { prisma } from "@/lib/prisma";
import type { EcosystemFlags } from "@/lib/ecosystem/flags";
import type { SearchKind } from "@/lib/ecosystem/searchCore";
import { listPublicVideos } from "@/lib/ecosystem/queries";
import { listUpcomingEvents } from "@/lib/ecosystem/events";

const has = (q: string) => ({ contains: q, mode: "insensitive" as const });
const PUBLIC_ORG = { approvalState: "APPROVED" as const, publicProfile: { is: { publicEnabled: true } } };

/**
 * Categorized search across everything public in the ecosystem. Plain
 * case-insensitive matching (no new index or extension): fine at the size
 * of the directory today, and nothing here reads data a visitor could not
 * already open from a public page. Only the requested category is queried.
 */
export async function searchEcosystem(q: string, kind: SearchKind, flags: EcosystemFlags) {
  const want = (k: SearchKind) => kind === "all" || kind === k;
  const limit = kind === "all" ? 5 : 20;

  const [organizations, videos, programs, events] = await Promise.all([
    want("organizations") && flags.orgPages
      ? prisma.trainingOrganization.findMany({
          where: { ...PUBLIC_ORG, OR: [{ name: has(q) }, { publicProfile: { is: { OR: [{ tagline: has(q) }, { location: has(q) }, { description: has(q) }] } } }] },
          take: limit,
          select: { id: true, name: true, publicProfile: { select: { slug: true, tagline: true, location: true, verified: true } } },
        })
      : [],
    want("videos") && flags.education && flags.orgPages
      ? listPublicVideos({ OR: [{ title: has(q) }, { topic: has(q) }, { description: has(q) }, { skills: { some: { skill: { name: has(q) } } } }] }, limit)
      : [],
    want("programs") && flags.orgPages
      ? (async () => {
          const orgs = await prisma.trainingOrganization.findMany({ where: { ...PUBLIC_ORG, staffUserId: { not: null } }, select: { name: true, staffUserId: true, publicProfile: { select: { slug: true } } } });
          const byStaff = new Map(orgs.map((o) => [o.staffUserId!, o]));
          const courses = await prisma.course.findMany({
            where: {
              status: "PUBLISHED", createdById: { in: [...byStaff.keys()] },
              OR: [{ title: has(q) }, { category: has(q) }, { skills: { some: { skill: { name: has(q) } } } }],
            },
            take: limit,
            select: { id: true, title: true, category: true, durationDisplay: true, createdById: true },
          });
          return courses.map((c) => ({ ...c, organizationName: byStaff.get(c.createdById)?.name ?? "", organizationSlug: byStaff.get(c.createdById)?.publicProfile?.slug ?? null }));
        })()
      : [],
    want("events") && flags.orgPages ? listUpcomingEvents({ q, take: limit }) : [],
  ]);
  return { organizations, videos, programs, events };
}
