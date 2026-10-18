/**
 * Gaming Arena: the course chat. One group chat per course, for the trainees enrolled in it, separate from the two-player game.
 * A Super Admin switches it on; instructors and admins who own the course moderate it (remove messages, suspend players).
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";
import { cleanMessage } from "@/lib/arena/arenaCore";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension, suspensionText } from "@/lib/arena/suspension";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";

export const CHAT_KEEP_DAYS = 7;
const SHOWN = 60;

export interface ChatMessageView { id: string; mine: boolean; name: string; initials: string; body: string; at: number }
export interface ChatView { enabled: boolean; messages: ChatMessageView[] }

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** What a player sees: the latest messages that have not been removed. */
export async function chatFor(courseId: string, viewerId: string): Promise<ChatView> {
  const enabled = (await availabilityForCourse(courseId)).chat;
  if (!enabled) return { enabled: false, messages: [] };
  const rows = await prisma.arenaChatMessage.findMany({
    where: { courseId, deletedAt: null, createdAt: { gte: new Date(Date.now() - CHAT_KEEP_DAYS * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: SHOWN,
    include: { sender: { select: { id: true, name: true } } },
  });
  return { enabled, messages: rows.reverse().map((m) => ({ id: m.id, mine: m.senderId === viewerId, name: m.sender.name, initials: initialsOf(m.sender.name), body: m.body, at: m.createdAt.getTime() })) };
}

export async function postChat(traineeId: string, courseId: string, raw: unknown): Promise<void> {
  if (!(await availabilityForCourse(courseId)).chat) throw new ArenaError("The course chat isn't open right now.", 403);
  if (!(await isEnrolled(traineeId, courseId))) throw new ArenaError("The chat is for trainees enrolled in this course.", 403);
  const suspended = await activeSuspension(traineeId, courseId);
  if (suspended) throw new ArenaError(suspensionText(suspended), 403);
  const body = cleanMessage(raw);
  if (!body) throw new ArenaError("Write a short message first.");
  // The same words again within a few seconds are a slip of the thumb, not a second message.
  const last = await prisma.arenaChatMessage.findFirst({ where: { courseId, senderId: traineeId }, orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true } });
  if (last && last.body === body && Date.now() - last.createdAt.getTime() < 10_000) return;
  await prisma.arenaChatMessage.create({ data: { courseId, senderId: traineeId, body } });
  void prisma.arenaChatMessage.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - CHAT_KEEP_DAYS * 86_400_000) } } }).catch(() => undefined);
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
}

/* ------------------------------ moderation ------------------------------ */

export interface ModerationView {
  chatOn: boolean;
  messages: { id: string; traineeId: string; name: string; body: string; at: number; removed: boolean; removedReason: string | null }[];
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
    messages: msgs.map((m) => ({ id: m.id, traineeId: m.senderId, name: m.sender.name, body: m.body, at: m.createdAt.getTime(), removed: m.deletedAt !== null, removedReason: m.deletedReason })),
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
