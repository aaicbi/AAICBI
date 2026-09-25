import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor, canAccessConversation, isBlocked, isMessagingSuspended } from "@/lib/messaging";

async function loadConversation(id: string) {
  return prisma.conversation.findUnique({ where: { id }, select: { id: true, type: true, cohortId: true } });
}

async function resolveDisplayName(type: "TRAINEE" | "STAFF", id: string): Promise<string> {
  if (type === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id }, select: { name: true } });
    return t?.name ?? "A trainee";
  }
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name ?? "A staff member";
}

/**
 * GET /api/conversations/[id]/messages?cursor=&limit=50 — oldest-to-
 * newest, cursor-paginated on createdAt/id. Side effect: marks the
 * caller's own ConversationParticipant.lastReadAt, creating that row
 * first for a COHORT conversation if it doesn't exist yet (it's purely
 * a read-tracking row there, never the access-control source — see
 * messaging.ts).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const conversation = await loadConversation(params.id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    const allowed = await canAccessConversation(session, conversation);
    if (!allowed) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50") || 50, 100);
    const cursor = req.nextUrl.searchParams.get("cursor");

    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const distinctAuthors = Array.from(new Map(messages.map((m) => [`${m.authorType}:${m.authorId}`, { type: m.authorType as "TRAINEE" | "STAFF", id: m.authorId }])).values());
    const names = await Promise.all(distinctAuthors.map(async (a) => [`${a.type}:${a.id}`, await resolveDisplayName(a.type, a.id)] as [string, string]));
    const nameMap = new Map<string, string>(names);

    // Mark read — but only for an actor who genuinely belongs to this
    // conversation. A SUPER_ADMIN browsing someone else's DM, or a
    // cohort chat for a course they don't own, is here for oversight
    // only and shouldn't pick up a stray read-tracking row.
    const actor = await resolveActor(session);
    const shouldTrackRead =
      session.role !== "SUPER_ADMIN" ||
      (conversation.type === "DIRECT"
        ? (await prisma.conversationParticipant.findUnique({
            where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId } },
          })) !== null
        : (await prisma.cohort.findUnique({ where: { id: conversation.cohortId! }, select: { course: { select: { createdById: true } } } }))?.course.createdById === session.userId);

    if (shouldTrackRead) {
      await prisma.conversationParticipant.upsert({
        where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId } },
        create: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      });
    }

    let title = "Conversation";
    let otherParticipant: { type: "TRAINEE" | "STAFF"; id: string; name: string } | null = null;
    if (conversation.type === "COHORT") {
      const cohort = await prisma.cohort.findUnique({ where: { id: conversation.cohortId! }, select: { name: true } });
      title = cohort?.name ?? "Cohort chat";
    } else {
      const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: conversation.id } });
      const myParticipant = participants.find((p) => p.participantType === actor.actorType && p.participantId === actor.actorId);
      if (myParticipant) {
        const other = participants.find((p) => p.id !== myParticipant.id);
        if (other) {
          const name = await resolveDisplayName(other.participantType as "TRAINEE" | "STAFF", other.participantId);
          otherParticipant = { type: other.participantType as "TRAINEE" | "STAFF", id: other.participantId, name };
          title = name;
        }
      } else if (participants.length === 2) {
        // A SUPER_ADMIN observing a DM neither party involves them in —
        // no single "other" to name, so show both.
        const names = await Promise.all(participants.map((p) => resolveDisplayName(p.participantType as "TRAINEE" | "STAFF", p.participantId)));
        title = names.join(" ↔ ");
      }
    }

    return NextResponse.json({
      title,
      otherParticipant,
      viewer: { actorType: actor.actorType, actorId: actor.actorId, isSuperAdmin: session.role === "SUPER_ADMIN", isMessagingSuspended: actor.actorType === "TRAINEE" ? await isMessagingSuspended(actor.actorId) : false },
      conversationType: conversation.type,
      messages: messages.map((m) => ({ id: m.id, authorType: m.authorType, authorId: m.authorId, authorName: nameMap.get(`${m.authorType}:${m.authorId}`), body: m.body, createdAt: m.createdAt })),
      nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
    });
  });
}

const SendSchema = z.object({ body: z.string().trim().min(1).max(5000) });

/**
 * POST /api/conversations/[id]/messages — send. A SUPER_ADMIN with
 * oversight access to a DM they aren't a party to cannot send into it
 * (canAccessConversation grants read visibility, not the ability to
 * inject messages into someone else's private conversation).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const conversation = await loadConversation(params.id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    const allowed = await canAccessConversation(session, conversation);
    if (!allowed) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    const actor = await resolveActor(session);

    if (conversation.type === "DIRECT") {
      const isParticipant = await prisma.conversationParticipant.findUnique({
        where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId } },
      });
      if (!isParticipant) {
        return NextResponse.json({ error: "You can view this conversation but can't send into it." }, { status: 403 });
      }
    }

    if (actor.actorType === "TRAINEE" && (await isMessagingSuspended(actor.actorId))) {
      return NextResponse.json({ error: "Your messaging access has been suspended. You can still read your conversations." }, { status: 403 });
    }

    if (conversation.type === "DIRECT") {
      const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: conversation.id } });
      const other = participants.find((p) => !(p.participantType === actor.actorType && p.participantId === actor.actorId));
      if (other) {
        const me = { type: actor.actorType, id: actor.actorId };
        const them = { type: other.participantType as "TRAINEE" | "STAFF", id: other.participantId };
        if ((await isBlocked(them, me)) || (await isBlocked(me, them))) {
          return NextResponse.json({ error: "You can't message this user." }, { status: 403 });
        }
      }
    }

    const body = await req.json().catch(() => null);
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A message body is required." }, { status: 400 });

    const [message] = await prisma.$transaction([
      prisma.conversationMessage.create({ data: { conversationId: conversation.id, authorType: actor.actorType, authorId: actor.actorId, body: parsed.data.body } }),
      prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
      prisma.conversationParticipant.upsert({
        where: { conversationId_participantType_participantId: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId } },
        create: { conversationId: conversation.id, participantType: actor.actorType, participantId: actor.actorId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      }),
    ]);

    return NextResponse.json({ id: message.id, createdAt: message.createdAt }, { status: 201 });
  });
}
