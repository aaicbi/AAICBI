import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { GrowthError } from "@/lib/growth/growth";
import { cleanSquadName, displayName, duelOutcome, squadPath, SQUAD_MAX_MEMBERS, type DuelOutcome } from "@/lib/growth/growthCore";

export const GROUPS_PAGE_SIZE = 25;

async function audit(actorId: string, action: string, scopeId: string, detail: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: "SQUAD", scopeId, detail: detail.slice(0, 300) } });
}

export interface GroupsFilter { campaignId?: string; q?: string; page?: number }
const pageOf = (n?: number) => Math.max(1, Math.floor(n || 1));

/** Every campaign that has a link, for the filter. */
export async function campaignChoices() {
  const rows = await prisma.growthCampaign.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, course: { select: { title: true } } }, take: 200 });
  return rows.map((r) => ({ id: r.id, title: r.course.title }));
}

/** Headline numbers across the filtered campaign (or all of them). */
export async function groupsSummary(campaignId?: string) {
  const where = campaignId ? { campaignId } : {};
  const [squads, inSquads, challenges, finishedChallenges] = await Promise.all([
    prisma.growthSquad.count({ where }),
    prisma.growthGuestPlay.count({ where: { ...where, squadId: { not: null } } }),
    prisma.growthGuestPlay.count({ where: { ...where, duelOfId: { not: null } } }),
    prisma.growthGuestPlay.count({ where: { ...where, duelOfId: { not: null }, completedAt: { not: null } } }),
  ]);
  return { squads, inSquads, challenges, finishedChallenges };
}

export async function squadsList(f: GroupsFilter) {
  const page = pageOf(f.page);
  const q = f.q?.trim().slice(0, 40);
  const where = { ...(f.campaignId ? { campaignId: f.campaignId } : {}), ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) };
  const [total, rows] = await Promise.all([
    prisma.growthSquad.count({ where }),
    prisma.growthSquad.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * GROUPS_PAGE_SIZE, take: GROUPS_PAGE_SIZE, include: { campaign: { select: { slug: true, course: { select: { title: true } } } } } }),
  ]);
  const ids = rows.map((r) => r.id);
  const [joined, finished, rivals, rivalOf, captains] = await Promise.all([
    prisma.growthGuestPlay.groupBy({ by: ["squadId"], where: { squadId: { in: ids } }, _count: { _all: true } }),
    prisma.growthGuestPlay.groupBy({ by: ["squadId"], where: { squadId: { in: ids }, completedAt: { not: null } }, _count: { _all: true }, _sum: { score: true } }),
    prisma.growthSquad.groupBy({ by: ["rivalOfId"], where: { rivalOfId: { in: ids } }, _count: { _all: true } }),
    prisma.growthSquad.findMany({ where: { id: { in: rows.map((r) => r.rivalOfId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    prisma.growthGuestPlay.findMany({ where: { id: { in: rows.map((r) => r.captainPlayId).filter((x): x is string => !!x) } }, select: { id: true, nickname: true } }),
  ]);
  const by = <T extends { squadId?: string | null; rivalOfId?: string | null }>(g: T[], key: "squadId" | "rivalOfId") => new Map(g.map((x) => [x[key] as string, x]));
  const joinedBy = by(joined, "squadId"), finishedBy = by(finished, "squadId"), rivalsBy = by(rivals, "rivalOfId");
  return {
    total, page, pages: Math.max(1, Math.ceil(total / GROUPS_PAGE_SIZE)),
    rows: rows.map((r) => {
      const fin = finishedBy.get(r.id);
      const done = fin?._count._all ?? 0, points = fin?._sum.score ?? 0;
      const perPlay = (r.questionIds as string[]).length;
      return {
        id: r.id, name: r.name, course: r.campaign.course.title, createdAt: r.createdAt.toISOString(),
        members: joinedBy.get(r.id)?._count._all ?? 0, maxMembers: SQUAD_MAX_MEMBERS, finished: done, points, outOf: done * perPlay,
        captain: displayName(captains.find((c) => c.id === r.captainPlayId)?.nickname),
        rivalOf: rivalOf.find((x) => x.id === r.rivalOfId)?.name ?? null,
        answeredBy: rivalsBy.get(r.id)?._count._all ?? 0,
        joinUrl: appUrl(squadPath(r.campaign.slug, r.code)),
      };
    }),
  };
}

export async function challengesList(f: GroupsFilter) {
  const page = pageOf(f.page);
  const where = { duelOfId: { not: null }, ...(f.campaignId ? { campaignId: f.campaignId } : {}) };
  const [total, rows] = await Promise.all([
    prisma.growthGuestPlay.count({ where }),
    prisma.growthGuestPlay.findMany({ where, orderBy: { startedAt: "desc" }, skip: (page - 1) * GROUPS_PAGE_SIZE, take: GROUPS_PAGE_SIZE, include: { campaign: { select: { course: { select: { title: true } } } } } }),
  ]);
  const originals = await prisma.growthGuestPlay.findMany({ where: { id: { in: rows.map((r) => r.duelOfId as string) } }, select: { id: true, nickname: true, score: true, durationMs: true } });
  return {
    total, page, pages: Math.max(1, Math.ceil(total / GROUPS_PAGE_SIZE)),
    rows: rows.map((r) => {
      const o = originals.find((x) => x.id === r.duelOfId);
      const outcome: DuelOutcome | null = r.completedAt && o ? duelOutcome({ score: r.score, durationMs: r.durationMs }, { score: o.score, durationMs: o.durationMs }) : null;
      return {
        id: r.id, course: r.campaign.course.title, startedAt: r.startedAt.toISOString(), finished: !!r.completedAt,
        challenger: { id: o?.id ?? null, name: displayName(o?.nickname), named: !!o?.nickname, score: o?.score ?? 0 },
        responder: { id: r.id, name: displayName(r.nickname), named: !!r.nickname, score: r.score },
        outcome,
      };
    }),
  };
}

export async function renameSquad(actorId: string, squadId: string, nameIn: unknown) {
  const name = cleanSquadName(nameIn);
  if (!name) throw new GrowthError("A squad name is 3 to 24 letters, numbers or spaces.");
  const sq = await prisma.growthSquad.findUnique({ where: { id: squadId }, select: { name: true } });
  if (!sq) throw new GrowthError("That squad could not be found.", 404);
  await prisma.growthSquad.update({ where: { id: squadId }, data: { name } });
  await audit(actorId, "SQUAD_RENAMED", squadId, `${sq.name} to ${name}`);
}

/** Deletes the squad. Its members' plays and scores stay; they just stop counting for a squad. Squads it challenged lose the link. */
export async function removeSquad(actorId: string, squadId: string) {
  const sq = await prisma.growthSquad.findUnique({ where: { id: squadId }, select: { name: true } });
  if (!sq) throw new GrowthError("That squad could not be found.", 404);
  await prisma.$transaction([
    prisma.growthGuestPlay.updateMany({ where: { squadId }, data: { squadId: null } }),
    prisma.growthGuestPlay.updateMany({ where: { rivalSquadId: squadId }, data: { rivalSquadId: null } }),
    prisma.growthSquad.updateMany({ where: { rivalOfId: squadId }, data: { rivalOfId: null } }),
    prisma.growthSquad.delete({ where: { id: squadId } }),
  ]);
  await audit(actorId, "SQUAD_REMOVED", squadId, sq.name);
}

/** Removes a nickname shown on a challenge, a standing or a squad board. The play and its score stay. */
export async function clearNickname(actorId: string, playId: string) {
  const play = await prisma.growthGuestPlay.findUnique({ where: { id: playId }, select: { nickname: true } });
  if (!play) throw new GrowthError("That play could not be found.", 404);
  if (!play.nickname) return;
  await prisma.growthGuestPlay.update({ where: { id: playId }, data: { nickname: null } });
  await audit(actorId, "NAME_CLEARED", playId, play.nickname);
}
