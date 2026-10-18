/**
 * Ayakbi Arena: moderation of the game. Players and watchers report a match; the course's instructors and admins see live and recent
 * matches and the reports, can end a live match, take a finished result off the ladder, remove a message from a match chat, suspend a
 * player, and close a report. Everything a moderator does is recorded with who did it.
 */
import { prisma } from "@/lib/prisma";
import { ArenaError, mutate } from "@/lib/arena/arena";
import { suspendPlayer } from "@/lib/arena/chat";
import { sendPushForNotification } from "@/lib/push/send";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { checkReport, reasonLabel, undoCounters } from "@/lib/arena/moderationCore";

async function tell(recipientType: "TRAINEE" | "STAFF", recipientId: string, note: { type: string; title: string; body: string; url: string }) {
  try {
    await prisma.userNotification.create({ data: { recipientType, recipientId, ...note } });
    await sendPushForNotification(recipientType, recipientId, note);
  } catch (e) { console.error("Moderation notification failed:", e); }
}

/* ------------------------------ reporting ------------------------------ */

export async function reportMatch(reporterId: string, matchId: string, input: { reason: unknown; note?: unknown; reportedId?: string | null }) {
  const m = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  const isPlayer = m.challengerId === reporterId || m.opponentId === reporterId;
  const watched = isPlayer ? true : !!(await prisma.arenaSpectator.findUnique({ where: { matchId_traineeId: { matchId, traineeId: reporterId } } }));
  if (!watched) throw new ArenaError("You can report a match you played or watched.", 403);
  const recent = await prisma.arenaReport.count({ where: { reporterId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  const v = checkReport({ reason: input.reason, note: input.note, recentCount: recent });
  if (!v.ok) throw new ArenaError(v.error, 429);
  // Who is being reported: the other player when you played, or one of the two players when you watched.
  let reportedId: string | null = null;
  if (isPlayer) reportedId = m.challengerId === reporterId ? m.opponentId : m.challengerId;
  else if (input.reportedId && (input.reportedId === m.challengerId || input.reportedId === m.opponentId)) reportedId = input.reportedId;
  if (await prisma.arenaReport.findFirst({ where: { matchId, reporterId, status: "OPEN" }, select: { id: true } })) throw new ArenaError("You have already reported this match. A moderator will look at it.", 409);
  const report = await prisma.arenaReport.create({ data: { courseId: m.courseId, matchId, reporterId, reportedId, reason: v.reason, note: v.note } });
  const course = await prisma.course.findUnique({ where: { id: m.courseId }, select: { createdById: true, title: true } });
  if (course?.createdById) void tell("STAFF", course.createdById, { type: "ARENA_REPORT", title: `Arena report: ${reasonLabel(v.reason)}`, body: `${course.title}. A match was reported. Open the course settings to review it.`, url: `/admin/courses/${m.courseId}#arena-moderation` });
  return { id: report.id };
}

/* ------------------------------ what moderators see ------------------------------ */

export async function moderationOverview(courseId: string) {
  const [reports, matches] = await Promise.all([
    prisma.arenaReport.findMany({ where: { courseId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 30 }),
    prisma.arenaMatch.findMany({ where: { courseId, status: { in: ["LOBBY", "ACTIVE", "COMPLETED", "FORFEITED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const ids = Array.from(new Set([...reports.flatMap((r) => [r.reporterId, r.reportedId].filter((x): x is string => !!x)), ...matches.flatMap((m) => [m.challengerId, m.opponentId])]));
  const people = await prisma.trainee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const name = new Map(people.map((p) => [p.id, p.name]));
  const n = (id: string | null) => (id ? name.get(id) ?? "A trainee" : null);
  return {
    reports: reports.map((r) => ({ id: r.id, matchId: r.matchId, reason: reasonLabel(r.reason), note: r.note, status: r.status, reporter: n(r.reporterId), reported: n(r.reportedId), reportedId: r.reportedId, at: r.createdAt.getTime(), handledNote: r.handledNote })),
    matches: matches.map((m) => ({ id: m.id, a: n(m.challengerId)!, b: n(m.opponentId)!, status: m.status, scoreA: m.scoreChallenger, scoreB: m.scoreOpponent, voided: m.voidedAt !== null, endReason: m.endReason, at: (m.endedAt ?? m.createdAt).getTime(), event: !!m.eventId })),
  };
}

export async function matchLog(courseId: string, matchId: string) {
  const m = await prisma.arenaMatch.findFirst({ where: { id: matchId, courseId } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  const msgs = await prisma.arenaMessage.findMany({ where: { matchId }, orderBy: { createdAt: "asc" }, take: 100 });
  const reactions = await prisma.arenaReaction.count({ where: { matchId } });
  return { a: m.challengerId, b: m.opponentId, messages: msgs.map((x) => ({ id: x.id, from: x.senderId === m.challengerId ? "a" : "b", body: x.body, at: x.createdAt.getTime(), removed: x.deletedAt !== null })), reactions };
}

/* ------------------------------ what moderators do ------------------------------ */

/** Stops a match that is still being played. Nothing counts on the ladder. */
export async function endMatch(courseId: string, matchId: string, staffId: string) {
  const m = await prisma.arenaMatch.findFirst({ where: { id: matchId, courseId } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  if (m.status !== "ACTIVE" && m.status !== "LOBBY" && m.status !== "PENDING") throw new ArenaError("That match is already over.", 409);
  await mutate(matchId, (d, now) => {
    if (d.m.status !== "ACTIVE" && d.m.status !== "LOBBY" && d.m.status !== "PENDING") return;
    d.m.status = "CANCELLED"; d.m.phase = null; d.m.phaseEndsAt = null; d.m.pausedById = null; d.m.pausedAt = null; d.m.pauseRemainingMs = null;
    d.m.endedAt = new Date(now); d.m.endReason = "staff-ended"; d.m.winnerId = null;
  });
  void prisma.arenaMatch.update({ where: { id: matchId }, data: { voidedById: staffId } }).catch(() => undefined);
  for (const id of [m.challengerId, m.opponentId]) void tell("TRAINEE", id, { type: "ARENA_MODERATION", title: "A moderator ended your match", body: "The match was stopped and does not count on the ladder.", url: `/trainee/arena/${courseId}` });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);
}

/** Takes a finished match off the ladder: both ratings go back to what they were. Safe to run twice. */
export async function voidMatch(courseId: string, matchId: string, staffId: string) {
  const m = await prisma.arenaMatch.findFirst({ where: { id: matchId, courseId } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  if (m.status !== "COMPLETED" && m.status !== "FORFEITED") throw new ArenaError("Only a finished match can be taken off the ladder.", 409);
  if (m.voidedAt) return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.arenaMatch.updateMany({ where: { id: matchId, voidedAt: null }, data: { voidedAt: new Date(), voidedById: staffId } });
    if (claimed.count === 0) return;
    const changes = await tx.arenaRatingChange.findMany({ where: { matchId, voided: false } });
    for (const c of changes) {
      if (c.counted) {
        const u = undoCounters(c.result);
        await tx.arenaRating.update({ where: { traineeId_courseId: { traineeId: c.traineeId, courseId } }, data: { rating: { decrement: c.delta }, matches: { decrement: 1 }, wins: { decrement: u.wins }, losses: { decrement: u.losses }, draws: { decrement: u.draws } } });
      }
      await tx.arenaRatingChange.update({ where: { id: c.id }, data: { voided: true } });
    }
  });
  for (const id of [m.challengerId, m.opponentId]) void tell("TRAINEE", id, { type: "ARENA_MODERATION", title: "A moderator took a match off the ladder", body: "Your ladder points for that match were put back.", url: `/trainee/arena/${courseId}/ladder` });
}

export async function removeMatchMessage(courseId: string, matchId: string, messageId: string, staffId: string) {
  const m = await prisma.arenaMatch.findFirst({ where: { id: matchId, courseId }, select: { id: true } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  const r = await prisma.arenaMessage.updateMany({ where: { id: messageId, matchId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: staffId } });
  if (r.count === 0) throw new ArenaError("That message could not be found.", 404);
}

export async function resolveReport(courseId: string, reportId: string, staffId: string, input: { action: "dismiss" | "resolve"; note?: string | null; suspendHours?: number | null; voidResult?: boolean; endMatchNow?: boolean }) {
  const r = await prisma.arenaReport.findFirst({ where: { id: reportId, courseId } });
  if (!r) throw new ArenaError("That report could not be found.", 404);
  if (r.status !== "OPEN") throw new ArenaError("That report has already been handled.", 409);
  if (input.action === "resolve") {
    if (input.endMatchNow) await endMatch(courseId, r.matchId, staffId).catch(() => undefined);
    if (input.voidResult) await voidMatch(courseId, r.matchId, staffId).catch(() => undefined);
    if (input.suspendHours && r.reportedId) await suspendPlayer(courseId, r.reportedId, staffId, { hours: input.suspendHours, reason: `Reported: ${reasonLabel(r.reason)}`, removeRecent: false });
  }
  await prisma.arenaReport.update({ where: { id: reportId }, data: { status: input.action === "dismiss" ? "DISMISSED" : "RESOLVED", handledById: staffId, handledNote: input.note?.slice(0, 300) || null, resolvedAt: new Date() } });
  void tell("TRAINEE", r.reporterId, { type: "ARENA_MODERATION", title: "A moderator reviewed your report", body: input.action === "dismiss" ? "Thank you for letting us know. We found nothing to act on." : "Thank you for letting us know. We took action.", url: `/trainee/arena/${courseId}` });
}
