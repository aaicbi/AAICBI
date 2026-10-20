import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { requirePermission, PermissionError, orgPolicyOf, type Access } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import type { OrgGamingPolicyInput } from "@/lib/rbac/resolve";
import type { StudioSession } from "@/lib/quest/studioAccess";
import { playerTable, gameOptions, playerDetail } from "@/lib/quest/results";
import { ArenaError } from "@/lib/arena/arena";
import { endMatch, resolveReport } from "@/lib/arena/moderation";
import { liftSuspension, removeChatMessage, suspendPlayer } from "@/lib/arena/chat";
import { organizationOfCourse, saveScope, scopeRow } from "@/lib/arena/config";
import { ARENA_DEFAULTS, RULE_KEYS, availability, resolveArena, sanitizeArenaPatch } from "@/lib/arena/configCore";
import { ACTION_LABEL, liveFlags, mayToggle, cleanReason, ORG_SWITCH_KEYS, type ActionKind } from "@/lib/orggames/core";

/**
 * Games for a training organization, and only its own: its courses, its trainees, its course group chats. Everything starts from the
 * organization in the signed-in session (never from anything the request says), every course or person named in a request is checked against it,
 * and a cross-organization attempt is refused as "not found" and recorded.
 */
export class OrgGamesError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface OrgCtx {
  session: SessionPayload;
  access: Access;
  policy: OrgGamingPolicyInput;
  organizationId: string;
  organizationName: string;
  /** The internal account that owns the organization's courses. */
  ownerUserId: string;
  actorName: string;
  courseIds: string[];
  /** The organization's courses seen as a game-results viewer (never the whole platform). */
  studio: StudioSession;
}

export async function orgCtx(permission: string): Promise<OrgCtx> {
  const { session, access } = await requirePermission(permission);
  if (access.kind !== "organization" || !access.organizationId || !access.organizationUserId) throw new PermissionError(permission);
  const courses = await prisma.course.findMany({ where: { createdById: access.organizationUserId }, select: { id: true }, take: 1000 });
  const studio: StudioSession = { userId: access.organizationUserId, role: "ADMIN", isSuper: false, scopeAll: false, permissions: [], has: () => false };
  return {
    session, access, policy: await orgPolicyOf(access.organizationId), organizationId: access.organizationId, organizationName: access.organizationName ?? "",
    ownerUserId: access.organizationUserId, actorName: session.actor?.name ?? access.organizationName ?? "Organization", courseIds: courses.map((c) => c.id), studio,
  };
}

/** The course must belong to this organization: anything else is "not found", and the attempt is recorded. */
export async function ownCourse(ctx: OrgCtx, courseId: string): Promise<void> {
  if (ctx.courseIds.includes(courseId)) return;
  await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: "CROSS_ORG_ATTEMPT", resourceType: "course", resourceId: courseId.slice(0, 80), organizationId: ctx.organizationId, outcome: "DENIED" });
  throw new OrgGamesError("That course could not be found.", 404);
}

/** The trainee must be enrolled in the named course of this organization. */
export async function ownTrainee(ctx: OrgCtx, courseId: string, traineeId: string): Promise<void> {
  await ownCourse(ctx, courseId);
  const e = await prisma.courseEnrollment.findFirst({ where: { courseId, traineeId }, select: { id: true } });
  if (!e) {
    await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: "CROSS_ORG_ATTEMPT", resourceType: "trainee", resourceId: traineeId.slice(0, 80), organizationId: ctx.organizationId, outcome: "DENIED" });
    throw new OrgGamesError("That trainee could not be found in this course.", 404);
  }
}

/** The people enrolled in the organization's courses (optionally one course or one cohort). */
async function traineeSet(ctx: OrgCtx, o: { courseId?: string | null; cohortId?: string | null }): Promise<Set<string>> {
  const courses = o.courseId ? [o.courseId] : ctx.courseIds;
  const enr = await prisma.courseEnrollment.findMany({ where: { courseId: { in: courses } }, select: { traineeId: true }, take: 20000 });
  let ids = new Set(enr.map((e) => e.traineeId));
  if (o.cohortId) {
    const cohort = await prisma.cohort.findFirst({ where: { id: o.cohortId, courseId: { in: ctx.courseIds } }, select: { id: true } });
    if (!cohort) throw new OrgGamesError("That cohort could not be found.", 404);
    const inCohort = await prisma.enrollmentRecord.findMany({ where: { cohortId: o.cohortId }, select: { traineeId: true } });
    const keep = new Set(inCohort.map((r) => r.traineeId));
    ids = new Set([...ids].filter((i) => keep.has(i)));
  }
  return ids;
}

async function record(ctx: OrgCtx, kind: ActionKind, p: { courseId?: string | null; matchId?: string | null; traineeId?: string | null; reason: string; escalated?: boolean }) {
  const row = await prisma.gameModerationAction.create({
    data: { organizationId: ctx.organizationId, courseId: p.courseId ?? null, matchId: p.matchId ?? null, traineeId: p.traineeId ?? null, kind, reason: p.reason, actorType: ctx.session.actor?.type ?? "OWNER", actorId: ctx.session.actor?.id ?? ctx.organizationId, actorName: ctx.actorName, escalatedAt: p.escalated ? new Date() : null },
  });
  await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: `GAME_${kind}`, resourceType: "game_moderation", resourceId: row.id, organizationId: ctx.organizationId, reason: p.reason, after: { courseId: p.courseId ?? null, traineeId: p.traineeId ?? null, matchId: p.matchId ?? null } });
  return row;
}

async function tellTrainee(traineeId: string, title: string, body: string, url: string) {
  try { await prisma.userNotification.create({ data: { recipientType: "TRAINEE", recipientId: traineeId, type: "ARENA_MODERATION", title, body, url } }); } catch { /* a missed notice never blocks a decision */ }
}

/* ------------------------------ overview ------------------------------ */

export async function overview(ctx: OrgCtx) {
  const [courses, cohorts, games, trainees, activeNow, openReports, escalated] = await Promise.all([
    prisma.course.findMany({ where: { id: { in: ctx.courseIds } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.cohort.findMany({ where: { courseId: { in: ctx.courseIds } }, orderBy: { name: "asc" }, select: { id: true, name: true, courseId: true } }),
    gameOptions(ctx.studio),
    traineeSet(ctx, {}),
    prisma.arenaMatch.count({ where: { courseId: { in: ctx.courseIds }, status: { in: ["LOBBY", "ACTIVE"] } } }),
    prisma.arenaReport.count({ where: { courseId: { in: ctx.courseIds }, status: "OPEN" } }),
    prisma.gameModerationAction.count({ where: { organizationId: ctx.organizationId, kind: "ESCALATED", resolvedAt: null } }),
  ]);
  return { organization: ctx.organizationName, courses, cohorts, games, can: [...ctx.access.permissions], policy: ctx.policy, stats: { trainees: trainees.size, activeNow, openReports, escalated } };
}

/* ------------------------------ results ------------------------------ */

export interface ResultsFilter { courseId: string | null; gameId: string | null; cohortId: string | null; traineeQuery: string; days: number | null }

export async function results(ctx: OrgCtx, f: ResultsFilter) {
  if (f.courseId) await ownCourse(ctx, f.courseId);
  const ids = await traineeSet(ctx, { courseId: f.courseId, cohortId: f.cohortId });
  const scope: StudioSession = f.courseId ? { ...ctx.studio } : ctx.studio;
  const { players, summary } = await playerTable(scope, { days: f.days, gameId: f.gameId, q: f.traineeQuery.slice(0, 80) }, { courseId: f.courseId ?? undefined, userIds: ids });
  return { players, summary };
}

export async function playerHistory(ctx: OrgCtx, traineeId: string) {
  const ids = await traineeSet(ctx, {});
  if (!ids.has(traineeId)) {
    await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: "CROSS_ORG_ATTEMPT", resourceType: "trainee", resourceId: traineeId.slice(0, 80), organizationId: ctx.organizationId, outcome: "DENIED" });
    throw new OrgGamesError("That trainee could not be found.", 404);
  }
  return playerDetail(ctx.studio, traineeId);
}

export async function leaderboard(ctx: OrgCtx, courseId: string) {
  await ownCourse(ctx, courseId);
  const [ladder, credits] = await Promise.all([
    prisma.arenaRating.findMany({ where: { courseId, hidden: false }, orderBy: { rating: "desc" }, take: 20, include: { trainee: { select: { name: true } } } }),
    prisma.arenaCredit.groupBy({ by: ["traineeId"], where: { courseId }, _sum: { points: true }, orderBy: { _sum: { points: "desc" } }, take: 10 }),
  ]);
  const names = new Map((await prisma.trainee.findMany({ where: { id: { in: credits.map((c) => c.traineeId) } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  return {
    ladder: ladder.map((r, i) => ({ rank: i + 1, name: r.trainee.name, rating: r.rating, matches: r.matches, wins: r.wins, losses: r.losses })),
    credits: credits.map((c, i) => ({ rank: i + 1, name: names.get(c.traineeId) ?? "A trainee", points: c._sum.points ?? 0 })),
  };
}

/* ------------------------------ live games ------------------------------ */

export async function live(ctx: OrgCtx) {
  const now = Date.now();
  const matches = await prisma.arenaMatch.findMany({
    where: { courseId: { in: ctx.courseIds }, status: { in: ["PENDING", "LOBBY", "ACTIVE"] } }, orderBy: { createdAt: "desc" }, take: 60,
    include: { course: { select: { title: true } }, challenger: { select: { name: true } }, opponent: { select: { name: true } } },
  });
  const reports = await prisma.arenaReport.groupBy({ by: ["matchId"], where: { courseId: { in: ctx.courseIds }, status: "OPEN", matchId: { in: matches.map((m) => m.id) } }, _count: { _all: true } });
  const open = new Map(reports.map((r) => [r.matchId, r._count._all]));
  return matches.map((m) => ({
    id: m.id, courseId: m.courseId, course: m.course.title, a: m.challenger.name, b: m.opponent.name, aId: m.challengerId, bId: m.opponentId, status: m.status, scoreA: m.scoreChallenger, scoreB: m.scoreOpponent,
    round: m.roundNo, startedAt: m.createdAt.getTime(), paused: m.pausedAt !== null, flags: liveFlags({ status: m.status, startedAt: m.createdAt.getTime(), openReports: open.get(m.id) ?? 0 }, now),
  }));
}

/* ------------------------------ moderation ------------------------------ */

export async function moderationFeed(ctx: OrgCtx) {
  const [reports, history, sus] = await Promise.all([
    prisma.arenaReport.findMany({ where: { courseId: { in: ctx.courseIds } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 50, include: { course: { select: { title: true } } } }),
    prisma.gameModerationAction.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.arenaSuspension.findMany({ where: { courseId: { in: ctx.courseIds } }, orderBy: { createdAt: "desc" }, take: 40, include: { trainee: { select: { name: true } }, course: { select: { title: true } } } }),
  ]);
  const ids = [...new Set([...reports.flatMap((r) => [r.reporterId, r.reportedId].filter((x): x is string => !!x)), ...history.map((h) => h.traineeId).filter((x): x is string => !!x)])];
  const names = new Map((await prisma.trainee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const n = (id: string | null) => (id ? names.get(id) ?? "A trainee" : null);
  const now = Date.now();
  return {
    reports: reports.map((r) => ({ id: r.id, courseId: r.courseId, course: r.course.title, matchId: r.matchId, reason: r.reason, note: r.note, status: r.status, reporter: n(r.reporterId), reported: n(r.reportedId), reportedId: r.reportedId, at: r.createdAt.getTime(), handledNote: r.handledNote })),
    restrictions: sus.map((x) => ({ id: x.id, courseId: x.courseId, course: x.course.title, traineeId: x.traineeId, name: x.trainee.name, reason: x.reason, since: x.createdAt.getTime(), until: x.expiresAt?.getTime() ?? null, lifted: x.liftedAt !== null, active: x.liftedAt === null && (!x.expiresAt || x.expiresAt.getTime() > now) })),
    history: history.map((h) => ({ id: h.id, kind: h.kind, label: ACTION_LABEL[h.kind as ActionKind] ?? h.kind, reason: h.reason, trainee: n(h.traineeId), by: h.actorName, at: h.createdAt.getTime(), escalated: h.escalatedAt !== null, resolved: h.resolvedAt !== null })),
  };
}

function need(ctx: OrgCtx, key: string) {
  if (!ctx.access.permissions.has(key)) throw new PermissionError(key);
}

export async function warn(ctx: OrgCtx, i: { courseId: string; traineeId: string; reason: unknown }) {
  need(ctx, "org_games.reports:moderate");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownTrainee(ctx, i.courseId, i.traineeId);
  await record(ctx, "WARNING", { courseId: i.courseId, traineeId: i.traineeId, reason: r.reason });
  await tellTrainee(i.traineeId, "A warning about game conduct", r.reason, `/trainee/arena/${i.courseId}`);
}

export async function restrict(ctx: OrgCtx, i: { courseId: string; traineeId: string; hours: number | null; reason: unknown }) {
  need(ctx, "org_games.restrictions:manage");
  if (!ctx.policy.restrictTrainees) throw new PermissionError("org_games.restrictions:manage");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownTrainee(ctx, i.courseId, i.traineeId);
  await suspendPlayer(i.courseId, i.traineeId, ctx.ownerUserId, { hours: i.hours, reason: r.reason, removeRecent: false });
  await record(ctx, "RESTRICTION", { courseId: i.courseId, traineeId: i.traineeId, reason: `${r.reason} (${i.hours === null ? "until lifted" : `${i.hours} hours`})` });
  await tellTrainee(i.traineeId, "Your game participation is paused", r.reason, `/trainee/arena/${i.courseId}`);
}

export async function lift(ctx: OrgCtx, i: { courseId: string; suspensionId: string; reason: unknown }) {
  need(ctx, "org_games.restrictions:manage");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  const row = await prisma.arenaSuspension.findFirst({ where: { id: i.suspensionId, courseId: i.courseId }, select: { traineeId: true } });
  if (!row) throw new OrgGamesError("That restriction could not be found.", 404);
  await liftSuspension(i.courseId, i.suspensionId, ctx.ownerUserId);
  await record(ctx, "RESTRICTION_LIFTED", { courseId: i.courseId, traineeId: row.traineeId, reason: r.reason });
}

export async function endSession(ctx: OrgCtx, i: { courseId: string; matchId: string; reason: unknown; removeTraineeId?: string | null }) {
  need(ctx, i.removeTraineeId ? "org_games.restrictions:manage" : "org_games.sessions:moderate");
  if (i.removeTraineeId ? !ctx.policy.removeParticipants : !ctx.policy.endSessions) throw new PermissionError("org_games.sessions:moderate");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  const m = await prisma.arenaMatch.findFirst({ where: { id: i.matchId, courseId: i.courseId }, select: { id: true, challengerId: true, opponentId: true } });
  if (!m) throw new OrgGamesError("That game could not be found.", 404);
  if (i.removeTraineeId && ![m.challengerId, m.opponentId].includes(i.removeTraineeId)) throw new OrgGamesError("That person is not in this game.", 404);
  try { await endMatch(i.courseId, i.matchId, ctx.ownerUserId); } catch (e) { if (e instanceof ArenaError) throw new OrgGamesError(e.message, e.status); throw e; }
  // A two-player game cannot go on without one of them, so removing a player ends it for both and keeps the removed person out of this course's games until a moderator lifts it.
  if (i.removeTraineeId) {
    await suspendPlayer(i.courseId, i.removeTraineeId, ctx.ownerUserId, { hours: 24, reason: r.reason, removeRecent: false }).catch(() => undefined);
    await record(ctx, "REMOVAL", { courseId: i.courseId, matchId: i.matchId, traineeId: i.removeTraineeId, reason: r.reason });
    await tellTrainee(i.removeTraineeId, "You were removed from a game", r.reason, `/trainee/arena/${i.courseId}`);
  } else await record(ctx, "SESSION_ENDED", { courseId: i.courseId, matchId: i.matchId, reason: r.reason });
}

export async function decideReport(ctx: OrgCtx, i: { courseId: string; reportId: string; decision: "dismiss" | "resolve"; note: unknown; suspendHours?: number | null }) {
  need(ctx, "org_games.reports:moderate");
  const r = cleanReason(i.note); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  if (i.suspendHours) need(ctx, "org_games.restrictions:manage");
  try { await resolveReport(i.courseId, i.reportId, ctx.ownerUserId, { action: i.decision, note: r.reason, suspendHours: i.suspendHours ?? null }); } catch (e) { if (e instanceof ArenaError) throw new OrgGamesError(e.message, e.status); throw e; }
  await record(ctx, i.decision === "dismiss" ? "REPORT_DISMISSED" : "REPORT_RESOLVED", { courseId: i.courseId, reason: r.reason });
}

/** Sends a serious case to the Super Admins, with the reason, and keeps it on the organization's history until they close it. */
export async function escalate(ctx: OrgCtx, i: { courseId: string; traineeId?: string | null; matchId?: string | null; reason: unknown }) {
  need(ctx, "org_games.reports:moderate");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  if (i.traineeId) await ownTrainee(ctx, i.courseId, i.traineeId);
  if (i.matchId && !(await prisma.arenaMatch.findFirst({ where: { id: i.matchId, courseId: i.courseId }, select: { id: true } }))) throw new OrgGamesError("That game could not be found.", 404);
  const row = await record(ctx, "ESCALATED", { courseId: i.courseId, matchId: i.matchId ?? null, traineeId: i.traineeId ?? null, reason: r.reason, escalated: true });
  const supers = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", active: true }, select: { id: true }, take: 20 });
  for (const s of supers) {
    try { await prisma.userNotification.create({ data: { recipientType: "STAFF", recipientId: s.id, type: "GAME_ESCALATION", title: `${ctx.organizationName} escalated a game incident`, body: r.reason.slice(0, 160), url: "/admin/game-results" } }); } catch { /* ignore */ }
  }
  return row.id;
}

/* ------------------------------ course group chat games ------------------------------ */

export async function chatGames(ctx: OrgCtx, courseId: string | null) {
  const courses = courseId ? (await ownCourse(ctx, courseId), [courseId]) : ctx.courseIds;
  const [sprints, cards, removed] = await Promise.all([
    prisma.arenaSprint.findMany({ where: { courseId: { in: courses } }, orderBy: { createdAt: "desc" }, take: 40, include: { course: { select: { title: true } }, winner: { select: { name: true } }, _count: { select: { answers: true } } } }),
    prisma.arenaChatMessage.findMany({ where: { courseId: { in: courses }, kind: "CHALLENGE" }, orderBy: { createdAt: "desc" }, take: 40, include: { course: { select: { title: true } }, sender: { select: { name: true } } } }),
    prisma.arenaChatMessage.findMany({ where: { courseId: { in: courses }, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 20, include: { sender: { select: { name: true } } } }),
  ]);
  // The recent words in one course's group chat, so a message can be reviewed and removed. Private conversations are never included.
  const recent = courseId
    ? await prisma.arenaChatMessage.findMany({ where: { courseId, kind: "TEXT", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30, include: { sender: { select: { name: true } } } })
    : [];
  return {
    recent: recent.map((m) => ({ id: m.id, courseId: m.courseId, by: m.sender?.name ?? "A trainee", traineeId: m.senderId, body: m.body.slice(0, 240), at: m.createdAt.getTime() })),
    sprints: sprints.map((s) => ({ id: s.id, courseId: s.courseId, course: s.course.title, question: s.questionText.slice(0, 160), status: s.status, winner: s.winner?.name ?? null, answers: s._count.answers, points: s.points, at: s.createdAt.getTime() })),
    challenges: cards.map((c) => ({ id: c.id, courseId: c.courseId, course: c.course.title, matchId: c.refId, from: c.sender?.name ?? null, text: c.body.slice(0, 160), at: c.createdAt.getTime() })),
    removed: removed.map((m) => ({ id: m.id, courseId: m.courseId, by: m.sender?.name ?? "The arena", reason: m.deletedReason, at: m.deletedAt?.getTime() ?? 0 })),
  };
}

export async function removeMessage(ctx: OrgCtx, i: { courseId: string; messageId: string; reason: unknown }) {
  need(ctx, "org_games.chat_games:moderate");
  if (!ctx.policy.chatGameModeration) throw new PermissionError("org_games.chat_games:moderate");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  const msg = await prisma.arenaChatMessage.findFirst({ where: { id: i.messageId, courseId: i.courseId }, select: { senderId: true } });
  try { await removeChatMessage(i.courseId, i.messageId, ctx.ownerUserId, r.reason); } catch (e) { if (e instanceof ArenaError) throw new OrgGamesError(e.message, e.status); throw e; }
  await record(ctx, "MESSAGE_REMOVED", { courseId: i.courseId, traineeId: msg?.senderId ?? null, reason: r.reason });
}

/** Stops one Fastest Fingers game in a course chat. */
export async function closeChatGame(ctx: OrgCtx, i: { courseId: string; sprintId: string; reason: unknown }) {
  need(ctx, "org_games.chat_games:moderate");
  if (!ctx.policy.chatGameModeration) throw new PermissionError("org_games.chat_games:moderate");
  const r = cleanReason(i.reason); if (!r.ok) throw new OrgGamesError(r.error);
  await ownCourse(ctx, i.courseId);
  const done = await prisma.arenaSprint.updateMany({ where: { id: i.sprintId, courseId: i.courseId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
  if (done.count === 0) throw new OrgGamesError("That game is already over or could not be found.", 409);
  await record(ctx, "CHAT_GAME_CLOSED", { courseId: i.courseId, reason: r.reason });
}

/* ------------------------------ settings for its own courses ------------------------------ */

async function describeCourse(courseId: string) {
  const { organizationId } = await organizationOfCourse(courseId);
  const [platform, org, own] = await Promise.all([scopeRow("PLATFORM"), organizationId ? scopeRow("ORGANIZATION", organizationId) : null, scopeRow("COURSE", courseId)]);
  const inherited = resolveArena([platform, org]);
  const effective = resolveArena([platform, org, own]);
  return { inherited, effective, rules: Object.fromEntries(RULE_KEYS.map((k) => [k, { value: effective[k], default: ARENA_DEFAULTS[k] }])), available: availability(effective) };
}

export async function settings(ctx: OrgCtx) {
  const courses = await prisma.course.findMany({ where: { id: { in: ctx.courseIds } }, orderBy: { title: "asc" }, select: { id: true, title: true }, take: 200 });
  const out = [];
  for (const c of courses) {
    const d = await describeCourse(c.id);
    out.push({ id: c.id, title: c.title, switches: Object.fromEntries(ORG_SWITCH_KEYS.map((k) => [k, { on: d.effective[k] === true, platformAllows: d.inherited[k] === true }])), rules: d.rules });
  }
  return { courses: out, canToggle: ctx.policy.toggleGames, canSetRules: ctx.policy.courseRules };
}

export async function updateSettings(ctx: OrgCtx, i: { courseId: string; switches?: Record<string, unknown>; rules?: unknown }) {
  need(ctx, "org_games.settings:configure");
  await ownCourse(ctx, i.courseId);
  const patch: Record<string, unknown> = {};
  if (i.switches && Object.keys(i.switches).length) {
    if (!ctx.policy.toggleGames) throw new PermissionError("org_games.settings:configure");
    const d = await describeCourse(i.courseId);
    for (const [k, v] of Object.entries(i.switches)) {
      if (typeof v !== "boolean") throw new OrgGamesError("A switch is on or off.");
      const ok = mayToggle(k, v, d.inherited as unknown as Record<string, unknown>);
      if (!ok.ok) throw new OrgGamesError(ok.reason, 403);
      patch[k] = v;
    }
  }
  if (i.rules !== undefined && i.rules !== null) {
    if (!ctx.policy.courseRules) throw new PermissionError("org_games.settings:configure");
    Object.assign(patch, sanitizeArenaPatch(i.rules as Record<string, unknown>, RULE_KEYS));
  }
  if (Object.keys(patch).length === 0) throw new OrgGamesError("Nothing to change.");
  await saveScope("COURSE", i.courseId, patch as never, ctx.ownerUserId);
  await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: "GAME_COURSE_SETTINGS_CHANGED", resourceType: "course", resourceId: i.courseId, organizationId: ctx.organizationId, after: { keys: Object.keys(patch) } });
}
