/**
 * In-app messaging — shared access-control and find-or-create logic
 * for DMs and cohort group chats. Centralized here so every route under
 * src/app/api/conversations/ enforces the exact same rules, rather than
 * re-deriving cohort/ownership/block checks per route.
 *
 * Access model (see prisma/schema.prisma's Conversation comment for the
 * full reasoning): SUPER_ADMIN has unscoped, full oversight of every
 * conversation. ADMIN/INSTRUCTOR are scoped to their own cohorts, via
 * the same course-ownership (createdById) convention used everywhere
 * else in this app. Trainees can DM cohort-mates and any staff member
 * who owns a course they're cohort-enrolled in, plus SUPER_ADMIN always.
 */
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

export type ActorType = "TRAINEE" | "STAFF";

export interface Actor {
  actorType: ActorType;
  actorId: string;
  name: string;
}

export async function resolveActor(session: SessionPayload): Promise<Actor> {
  if (session.role === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true } });
    return { actorType: "TRAINEE", actorId: session.userId, name: t?.name ?? "A trainee" };
  }
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  return { actorType: "STAFF", actorId: session.userId, name: u?.name ?? "A staff member" };
}

/** Deterministic, order-independent key for a DIRECT conversation's two
 * participants — sort the two "TYPE:id" tokens, join with "|". */
export function buildPairKey(a: { type: ActorType; id: string }, b: { type: ActorType; id: string }): string {
  const tokens = [`${a.type}:${a.id}`, `${b.type}:${b.id}`].sort();
  return tokens.join("|");
}

export async function areCohortMates(traineeIdA: string, traineeIdB: string): Promise<boolean> {
  if (traineeIdA === traineeIdB) return false;
  const [cohortsA, cohortsB] = await Promise.all([
    prisma.enrollmentRecord.findMany({ where: { traineeId: traineeIdA }, select: { cohortId: true } }),
    prisma.enrollmentRecord.findMany({ where: { traineeId: traineeIdB }, select: { cohortId: true } }),
  ]);
  const setA = new Set(cohortsA.map((c) => c.cohortId));
  return cohortsB.some((c) => setA.has(c.cohortId));
}

/** Can this staff member (ADMIN/INSTRUCTOR — SUPER_ADMIN always passes
 * before this is even called) reach this trainee: is the trainee
 * enrolled in a cohort of a course this staff member created. */
export async function canStaffReachTrainee(session: SessionPayload, traineeId: string): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;
  const match = await prisma.enrollmentRecord.findFirst({
    where: { traineeId, cohort: { course: { createdById: session.userId } } },
    select: { id: true },
  });
  return match !== null;
}

export async function canAccessCohortConversation(session: SessionPayload, cohortId: string): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "ADMIN" || session.role === "INSTRUCTOR") {
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId }, select: { course: { select: { createdById: true } } } });
    return cohort?.course.createdById === session.userId;
  }
  // TRAINEE
  const match = await prisma.enrollmentRecord.findFirst({ where: { cohortId, traineeId: session.userId }, select: { id: true } });
  return match !== null;
}

export async function isBlocked(blocker: { type: ActorType; id: string }, blocked: { type: ActorType; id: string }): Promise<boolean> {
  const row = await prisma.block.findUnique({
    where: {
      blockerType_blockerId_blockedType_blockedId: {
        blockerType: blocker.type,
        blockerId: blocker.id,
        blockedType: blocked.type,
        blockedId: blocked.id,
      },
    },
  });
  return row !== null;
}

export async function isMessagingSuspended(traineeId: string): Promise<boolean> {
  const t = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { messagingSuspendedAt: true } });
  return t?.messagingSuspendedAt != null;
}

/** Race-safe find-or-create via upsert on the unique pairKey column —
 * the same pattern src/lib/earlyWarning.ts's tryUpsertInactivityAlert
 * already uses for upsert-on-a-unique-column idempotency. */
export async function findOrCreateDirectConversation(a: { type: ActorType; id: string }, b: { type: ActorType; id: string }) {
  const pairKey = buildPairKey(a, b);
  const conversation = await prisma.conversation.upsert({
    where: { pairKey },
    create: { type: "DIRECT", pairKey },
    update: {},
  });
  await Promise.all(
    [a, b].map((p) =>
      prisma.conversationParticipant.upsert({
        where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: p.type, participantId: p.id } },
        create: { conversationId: conversation.id, participantType: p.type, participantId: p.id },
        update: {},
      })
    )
  );
  return conversation;
}

export async function findOrCreateCohortConversation(cohortId: string) {
  return prisma.conversation.upsert({
    where: { cohortId },
    create: { type: "COHORT", cohortId },
    update: {},
  });
}

/**
 * Loop's get_conversation_messages tool — SUPER_ADMIN-only reading of a
 * trainee's real message content, to check for abuse when asked. This
 * is genuinely more sensitive than every other Loop read (aggregated
 * records, never free-text between people), which is why the ask route
 * intercepts this tool call to remember the reviewed trainee server-
 * side (see lastReviewedTraineeId there) rather than trusting a
 * traineeId field on propose_messaging_suspension itself — the same
 * "Claude can't alter/hallucinate the target" discipline
 * resolve_recipients/analyze_module_materials already establish for
 * their own terminal propose tools.
 */
export async function getTraineeConversationMessagesForReview(traineeId: string, limit = 300) {
  const [directParticipation, cohortEnrollments] = await Promise.all([
    prisma.conversationParticipant.findMany({ where: { participantType: "TRAINEE", participantId: traineeId }, select: { conversationId: true } }),
    prisma.enrollmentRecord.findMany({ where: { traineeId }, select: { cohortId: true } }),
  ]);
  const cohortConversations = await prisma.conversation.findMany({
    where: { type: "COHORT", cohortId: { in: cohortEnrollments.map((e) => e.cohortId) } },
    select: { id: true },
  });
  const conversationIds = [...directParticipation.map((p) => p.conversationId), ...cohortConversations.map((c) => c.id)];
  if (conversationIds.length === 0) return [];

  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId: { in: conversationIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { conversationId: true, authorType: true, authorId: true, body: true, createdAt: true },
  });

  const distinctAuthors = Array.from(new Map(messages.map((m) => [`${m.authorType}:${m.authorId}`, { type: m.authorType as ActorType, id: m.authorId }])).values());
  const names = await Promise.all(distinctAuthors.map(async (a) => [`${a.type}:${a.id}`, await resolveDisplayName(a.type, a.id)] as [string, string]));
  const nameMap = new Map<string, string>(names);

  return messages
    .slice()
    .reverse()
    .map((m) => ({
      conversationId: m.conversationId,
      authorType: m.authorType,
      authorName: nameMap.get(`${m.authorType}:${m.authorId}`) ?? "Unknown",
      body: m.body,
      createdAt: m.createdAt,
    }));
}

async function resolveDisplayName(type: ActorType, id: string): Promise<string> {
  if (type === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id }, select: { name: true } });
    return t?.name ?? "A trainee";
  }
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name ?? "A staff member";
}

export async function canAccessConversation(
  session: SessionPayload,
  conversation: { id: string; type: "DIRECT" | "COHORT"; cohortId: string | null }
): Promise<boolean> {
  if (conversation.type === "COHORT") {
    if (!conversation.cohortId) return false;
    return canAccessCohortConversation(session, conversation.cohortId);
  }
  if (session.role === "SUPER_ADMIN") return true;
  const actor = await resolveActor(session);
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_participantType_participantId: {
        conversationId: conversation.id,
        participantType: actor.actorType,
        participantId: actor.actorId,
      },
    },
  });
  return participant !== null;
}
