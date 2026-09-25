import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor, findOrCreateCohortConversation, type Actor } from "@/lib/messaging";

/**
 * GET /api/conversations — the inbox list. One shared route for both
 * trainee and staff callers, branching on session.role rather than a
 * mirrored /api/trainee/... + /api/admin/... split — same dual-role
 * idiom as POST /api/messages/to-admin and GET /api/notifications.
 *
 * SUPER_ADMIN: every conversation, unscoped (the confirmed full-
 * oversight decision — see messaging.ts's own header comment).
 * ADMIN/INSTRUCTOR: only cohort conversations for cohorts of courses
 * they created, plus DIRECT conversations they're a participant in.
 * TRAINEE: their own DIRECT conversations plus every cohort they're
 * enrolled in (lazily creating that cohort's conversation on first
 * visit here, so a trainee who's never opened Messages before still
 * sees their cohort chat immediately).
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const actor = await resolveActor(session);

    let conversations: { id: string; type: "DIRECT" | "COHORT"; cohortId: string | null; lastMessageAt: Date }[];

    if (session.role === "SUPER_ADMIN") {
      conversations = await prisma.conversation.findMany({ orderBy: { lastMessageAt: "desc" } });
    } else if (session.role === "ADMIN" || session.role === "INSTRUCTOR") {
      const [ownedCohortConvos, myParticipantRows] = await Promise.all([
        prisma.conversation.findMany({ where: { type: "COHORT", cohort: { course: { createdById: session.userId } } } }),
        prisma.conversationParticipant.findMany({ where: { participantType: "STAFF", participantId: session.userId }, select: { conversationId: true } }),
      ]);
      const directConvos = await prisma.conversation.findMany({ where: { id: { in: myParticipantRows.map((r) => r.conversationId) }, type: "DIRECT" } });
      conversations = [...ownedCohortConvos, ...directConvos].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    } else {
      const myCohorts = await prisma.enrollmentRecord.findMany({ where: { traineeId: session.userId }, select: { cohortId: true } });
      const [cohortConvos, myParticipantRows] = await Promise.all([
        Promise.all(myCohorts.map((c) => findOrCreateCohortConversation(c.cohortId))),
        prisma.conversationParticipant.findMany({ where: { participantType: "TRAINEE", participantId: session.userId }, select: { conversationId: true } }),
      ]);
      const directConvos = await prisma.conversation.findMany({ where: { id: { in: myParticipantRows.map((r) => r.conversationId) }, type: "DIRECT" } });
      conversations = [...cohortConvos, ...directConvos].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    }

    const rows = await Promise.all(conversations.map((c) => summarizeConversation(c, actor)));
    return NextResponse.json(rows);
  });
}

async function resolveDisplayName(type: "TRAINEE" | "STAFF", id: string): Promise<string> {
  if (type === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id }, select: { name: true } });
    return t?.name ?? "A trainee";
  }
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name ?? "A staff member";
}

async function summarizeConversation(conversation: { id: string; type: "DIRECT" | "COHORT"; cohortId: string | null }, actor: Actor) {
  const [lastMessage, myParticipant] = await Promise.all([
    prisma.conversationMessage.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true, authorType: true, authorId: true } }),
    prisma.conversationParticipant.findUnique({
      where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId } },
      select: { lastReadAt: true },
    }),
  ]);

  const unreadCount = await prisma.conversationMessage.count({
    where: {
      conversationId: conversation.id,
      createdAt: { gt: myParticipant?.lastReadAt ?? new Date(0) },
      NOT: { authorType: actor.actorType, authorId: actor.actorId },
    },
  });

  let title: string;
  let subtitle: string | null = null;
  if (conversation.type === "COHORT") {
    const cohort = await prisma.cohort.findUnique({ where: { id: conversation.cohortId! }, select: { name: true, course: { select: { title: true } } } });
    title = cohort?.name ?? "Cohort chat";
    subtitle = cohort?.course.title ?? null;
  } else {
    const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: conversation.id } });
    const myParticipant = participants.find((p) => p.participantType === actor.actorType && p.participantId === actor.actorId);
    if (myParticipant) {
      const other = participants.find((p) => p.id !== myParticipant.id);
      title = other ? await resolveDisplayName(other.participantType as "TRAINEE" | "STAFF", other.participantId) : "Conversation";
    } else if (participants.length === 2) {
      // SUPER_ADMIN oversight view of a DM neither party involves them in.
      const names = await Promise.all(participants.map((p) => resolveDisplayName(p.participantType as "TRAINEE" | "STAFF", p.participantId)));
      title = names.join(" ↔ ");
    } else {
      title = "Conversation";
    }
  }

  return {
    id: conversation.id,
    type: conversation.type,
    title,
    subtitle,
    lastMessage: lastMessage ? { body: lastMessage.body, createdAt: lastMessage.createdAt } : null,
    unreadCount,
  };
}
