/**
 * Ayakbi Arena: the course chat. One group chat per course, for the trainees enrolled in it, separate from the two-player game.
 * A Super Admin switches it on; instructors and admins who own the course moderate it (remove messages, suspend players).
 * Besides words, the chat carries two kinds of card: a game challenge (accept or decline in the chat) and a Fastest Fingers question.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";
import { cleanMessage } from "@/lib/arena/arenaCore";
import { ArenaError, createChallenge, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension, suspensionText } from "@/lib/arena/suspension";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { pushToCourse } from "@/lib/arena/chatPush";
import { creditsOf } from "@/lib/arena/credits";
import { sprintViews, type SprintView } from "@/lib/arena/sprint";

export const CHAT_KEEP_DAYS = 7;
const SHOWN = 60;

export interface ChallengeCard { matchId: string; status: string; fromName: string; toName: string; fromMe: boolean; toMe: boolean; topic: string | null }
export interface ChatMessageView {
  id: string;
  kind: "TEXT" | "CHALLENGE" | "FASTEST" | "SYSTEM";
  mine: boolean;
  name: string;
  initials: string;
  body: string;
  at: number;
  challenge?: ChallengeCard;
  sprint?: SprintView;
}
export interface ChatView { enabled: boolean; fastest: boolean; credits: number; messages: ChatMessageView[] }

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const SYSTEM_NAME = "Ayakbi Arena";

/** What a player sees: the latest messages that have not been removed. */
export async function chatFor(courseId: string, viewerId: string): Promise<ChatView> {
  const avail = await availabilityForCourse(courseId);
  if (!avail.chat) return { enabled: false, fastest: false, credits: 0, messages: [] };
  const rows = await prisma.arenaChatMessage.findMany({
    where: { courseId, deletedAt: null, createdAt: { gte: new Date(Date.now() - CHAT_KEEP_DAYS * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: SHOWN,
    include: { sender: { select: { id: true, name: true } } },
  });
  rows.reverse();
  const matchIds = rows.filter((m) => m.kind === "CHALLENGE" && m.refId).map((m) => m.refId as string);
  const sprintIds = rows.filter((m) => m.kind === "FASTEST" && m.refId).map((m) => m.refId as string);
  const [matches, sprints, credits] = await Promise.all([
    matchIds.length ? prisma.arenaMatch.findMany({ where: { id: { in: matchIds } }, select: { id: true, status: true, challengerId: true, opponentId: true, moduleId: true } }) : [],
    sprintIds.length ? sprintViews(sprintIds, viewerId) : new Map<string, SprintView>(),
    creditsOf(viewerId, courseId),
  ]);
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  const people = matches.length ? await prisma.trainee.findMany({ where: { id: { in: matches.flatMap((m) => [m.challengerId, m.opponentId]) } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const modIds = matches.map((m) => m.moduleId).filter((x): x is string => !!x);
  const mods = modIds.length ? await prisma.module.findMany({ where: { id: { in: modIds } }, select: { id: true, title: true } }) : [];
  const modTitle = new Map(mods.map((m) => [m.id, m.title]));
  return {
    enabled: true,
    fastest: avail.fastest,
    credits,
    messages: rows.map((m): ChatMessageView => {
      const name = m.sender?.name ?? SYSTEM_NAME;
      const base = { id: m.id, mine: !!m.sender && m.senderId === viewerId, name, initials: m.sender ? initialsOf(name) : "AA", body: m.body, at: m.createdAt.getTime() };
      if (m.kind === "CHALLENGE" && m.refId && byMatch.has(m.refId)) {
        const x = byMatch.get(m.refId)!;
        return { ...base, kind: "CHALLENGE", challenge: { matchId: x.id, status: x.status, fromName: nameOf.get(x.challengerId) ?? "A coursemate", toName: nameOf.get(x.opponentId) ?? "A coursemate", fromMe: x.challengerId === viewerId, toMe: x.opponentId === viewerId, topic: x.moduleId ? modTitle.get(x.moduleId) ?? null : null } };
      }
      if (m.kind === "FASTEST" && m.refId && sprints.has(m.refId)) return { ...base, kind: "FASTEST", sprint: sprints.get(m.refId) };
      return { ...base, kind: m.sender ? "TEXT" : "SYSTEM" };
    }),
  };
}

export async function postChat(traineeId: string, courseId: string, raw: unknown): Promise<void> {
  if (!(await availabilityForCourse(courseId)).chat) throw new ArenaError("The course chat isn't open right now.", 403);
  if (!(await isEnrolled(traineeId, courseId))) throw new ArenaError("The chat is for trainees enrolled in this course.", 403);
  const suspended = await activeSuspension(traineeId, courseId);
  if (suspended) throw new ArenaError(suspensionText(suspended), 403);
  const body = cleanMessage(raw);
  if (!body) throw new ArenaError("Write a short message first.");
  // The same words again within a few seconds are a slip of the thumb, not a second message.
  const last = await prisma.arenaChatMessage.findFirst({ where: { courseId, senderId: traineeId, kind: "TEXT" }, orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true } });
  if (last && last.body === body && Date.now() - last.createdAt.getTime() < 10_000) return;
  await prisma.arenaChatMessage.create({ data: { courseId, senderId: traineeId, body } });
  void prisma.arenaChatMessage.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - CHAT_KEEP_DAYS * 86_400_000) } } }).catch(() => undefined);
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
  const [who, course] = await Promise.all([prisma.trainee.findUnique({ where: { id: traineeId }, select: { name: true } }), prisma.course.findUnique({ where: { id: courseId }, select: { title: true } })]);
  void pushToCourse(courseId, traineeId, { title: `${who?.name ?? "A coursemate"} · ${course?.title ?? "Course chat"}`, body });
}

/** Challenge a coursemate and put the invitation in the chat, where they can accept or decline it. */
export async function challengeInChat(input: { challengerId: string; opponentId: string; courseId: string; moduleId?: string | null }) {
  const m = await createChallenge(input);
  const chat = (await availabilityForCourse(input.courseId)).chat;
  if (chat) {
    const [a, b] = await Promise.all([prisma.trainee.findUnique({ where: { id: input.challengerId }, select: { name: true } }), prisma.trainee.findUnique({ where: { id: input.opponentId }, select: { name: true } })]);
    await prisma.arenaChatMessage.create({ data: { courseId: input.courseId, senderId: input.challengerId, kind: "CHALLENGE", refId: m.id, body: `${a?.name ?? "Someone"} challenged ${b?.name ?? "a coursemate"} to Ayakbi Arena` } });
    void pokeMany([{ channel: channels.course(input.courseId), message: { v: 0, k: "chat" } }]);
    void pushToCourse(input.courseId, input.challengerId, { title: `${a?.name ?? "A coursemate"} challenged you`, body: "Open the chat to accept or decline.", url: `/trainee/arena/${input.courseId}/chat` }, [input.opponentId]);
  }
  return m;
}

/* ------------------------------ moderation ------------------------------ */

export interface ModerationView {
  chatOn: boolean;
  messages: { id: string; traineeId: string | null; name: string; body: string; at: number; removed: boolean; removedReason: string | null }[];
  suspensions: { id: string; traineeId: string; name: string; reason: string | null; since: number; until: number | null; lifted: boolean; active: boolean }[];
}

export async function moderationView(courseId: string): Promise<ModerationView> {
  const [avail, msgs, sus] = await Promise.all([
    availabilityForCourse(courseId),
    prisma.arenaChatMessage.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 100, include: { sender: { select: { id: true, name: true } } } }),
    prisma.arenaSuspension.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 40, include: { trainee: { select: { id: true, name: true } } } }),
  ]);
  const now = Date.now();
  return {
    chatOn: avail.chat,
    messages: msgs.map((m) => ({ id: m.id, traineeId: m.senderId, name: m.sender?.name ?? SYSTEM_NAME, body: m.body, at: m.createdAt.getTime(), removed: m.deletedAt !== null, removedReason: m.deletedReason })),
    suspensions: sus.map((x) => ({ id: x.id, traineeId: x.traineeId, name: x.trainee.name, reason: x.reason, since: x.createdAt.getTime(), until: x.expiresAt ? x.expiresAt.getTime() : null, lifted: x.liftedAt !== null, active: x.liftedAt === null && (!x.expiresAt || x.expiresAt.getTime() > now) })),
  };
}

export async function removeChatMessage(courseId: string, messageId: string, staffId: string, reason?: string | null): Promise<void> {
  const r = await prisma.arenaChatMessage.updateMany({ where: { id: messageId, courseId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: staffId, deletedReason: reason?.slice(0, 200) || null } });
  if (r.count === 0) throw new ArenaError("That message could not be found.", 404);
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
}

/** Stops a player from chatting and playing in this course's arena. `hours` null means until lifted. Optionally hides what they wrote in the last day. */
export async function suspendPlayer(courseId: string, traineeId: string, staffId: string, input: { hours: number | null; reason?: string | null; removeRecent?: boolean }): Promise<void> {
  const enrolled = await prisma.courseEnrollment.findFirst({ where: { courseId, traineeId }, select: { id: true } });
  if (!enrolled) throw new ArenaError("That trainee isn't enrolled in this course.", 404);
  const hours = input.hours === null ? null : Math.min(24 * 90, Math.max(1, Math.round(input.hours)));
  await prisma.arenaSuspension.create({ data: { courseId, traineeId, suspendedById: staffId, reason: input.reason?.slice(0, 200) || null, expiresAt: hours === null ? null : new Date(Date.now() + hours * 3_600_000) } });
  if (input.removeRecent) await prisma.arenaChatMessage.updateMany({ where: { courseId, senderId: traineeId, deletedAt: null, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, data: { deletedAt: new Date(), deletedById: staffId, deletedReason: "Removed with a suspension" } });
  // A suspended player leaves any waiting challenge and the list of people online.
  await prisma.arenaPresence.deleteMany({ where: { courseId, traineeId } });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }, { channel: channels.user(traineeId), message: { v: 0, k: "lobby" } }]);
}

export async function liftSuspension(courseId: string, suspensionId: string, staffId: string): Promise<void> {
  const r = await prisma.arenaSuspension.updateMany({ where: { id: suspensionId, courseId, liftedAt: null }, data: { liftedAt: new Date(), liftedById: staffId } });
  if (r.count === 0) throw new ArenaError("That suspension could not be found.", 404);
  const row = await prisma.arenaSuspension.findUnique({ where: { id: suspensionId }, select: { traineeId: true } });
  if (row) void pokeMany([{ channel: channels.user(row.traineeId), message: { v: 0, k: "lobby" } }]);
}
