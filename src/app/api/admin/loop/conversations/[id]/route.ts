import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudioUser, clampToAllowed } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { clampLevel } from "@/lib/loop/policy";
import { cardOf } from "@/lib/loop/runAction";

async function own(id: string, userId: string) {
  return prisma.loopConversation.findFirst({ where: { id, userId } });
}

/** GET — one saved chat with its messages, attachments and action cards. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    const conv = await own(params.id, session.userId);
    if (!conv) return NextResponse.json({ error: "That conversation could not be found." }, { status: 404 });
    const messages = await prisma.loopMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      include: { actions: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({
      id: conv.id,
      title: conv.title,
      level: conv.level,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachments: m.attachments,
        toolEvents: m.toolEvents,
        actions: m.actions.map((a) => cardOf(a as never)),
        createdAt: m.createdAt,
      })),
    });
  });
}

const Patch = z.object({ title: z.string().trim().min(1).max(120).optional(), level: z.union([z.number(), z.string()]).optional() });

/** PATCH — rename a chat or change its autonomy level. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    const conv = await own(params.id, session.userId);
    if (!conv) return NextResponse.json({ error: "That conversation could not be found." }, { status: 404 });
    const parsed = Patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const level = parsed.data.level !== undefined ? await clampToAllowed(clampLevel(parsed.data.level), session) : undefined;
    const updated = await prisma.loopConversation.update({
      where: { id: conv.id },
      data: { ...(parsed.data.title ? { title: parsed.data.title } : {}), ...(level ? { level } : {}) },
      select: { id: true, title: true, level: true },
    });
    if (level) await prisma.user.update({ where: { id: session.userId }, data: { loopLevel: level } }).catch(() => {});
    return NextResponse.json(updated);
  });
}

/** DELETE — remove a chat. Actions Loop took stay in the audit trail only through the chat they belong to, so deleting removes both. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    const conv = await own(params.id, session.userId);
    if (!conv) return NextResponse.json({ error: "That conversation could not be found." }, { status: 404 });
    await prisma.loopConversation.delete({ where: { id: conv.id } });
    return NextResponse.json({ deleted: true });
  });
}
