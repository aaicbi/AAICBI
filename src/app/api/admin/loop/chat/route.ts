import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudioUser, requireStudioPermission, clampToAllowed } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { buildHistory, attachmentContext, runLoopTurn, userContent, type LoopEvent } from "@/lib/loop/engine";
import { AttachmentError, processAttachments } from "@/lib/loop/attachments";
import { clampLevel, titleFromMessage } from "@/lib/loop/policy";

/**
 * POST /api/admin/loop/chat — one turn of a Command Center conversation,
 * streamed to the browser as server-sent events (see lib/loop/engine.ts).
 * SUPER_ADMIN only. Accepts JSON, or multipart form data when files are
 * attached. Creates the conversation on the first message.
 */
export const maxDuration = 60;

const Body = z.object({
  message: z.string().max(8000),
  conversationId: z.string().min(1).nullish(),
  level: z.union([z.number(), z.string()]).optional(),
  // Set by the Game Studio so Loop knows which module and game are on screen.
  studio: z.object({ moduleId: z.string().nullish(), gameId: z.string().nullish() }).nullish(),
});

const sse = (event: LoopEvent | { type: "meta"; conversationId: string; title: string; assistantMessageId: string; userMessageId: string }) =>
  new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    // Super Admins use Loop everywhere; admins, instructors and organization staff use it inside the Game Studio,
    // limited to their own modules and games and to the autonomy level a Super Admin has granted them.
    const session = await requireStudioUser();
    requireStudioPermission(session, "LOOP");

    const limited = await rateLimit(`loop-chat:${session.userId}:${clientIp(req)}`, 40, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many messages in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Loop isn't configured yet: ANTHROPIC_API_KEY is missing. See DEPLOYMENT.md." }, { status: 503 });
    }

    let fields: unknown;
    let files: File[] = [];
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      let studio: unknown = null;
      try {
        studio = form.get("studio") ? JSON.parse(String(form.get("studio"))) : null;
      } catch {
        studio = null;
      }
      fields = { message: String(form.get("message") ?? ""), conversationId: form.get("conversationId") || null, level: form.get("level") ?? undefined, studio };
      files = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
    } else {
      fields = await req.json().catch(() => null);
    }
    const parsed = Body.safeParse(fields);
    if (!parsed.success) return NextResponse.json({ error: "A message is required." }, { status: 400 });
    const text = parsed.data.message.trim();
    if (!text && files.length === 0) return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });

    let attachments;
    try {
      attachments = await processAttachments(files);
    } catch (e) {
      if (e instanceof AttachmentError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const level = await clampToAllowed(clampLevel(parsed.data.level), session);
    const existing = parsed.data.conversationId
      ? await prisma.loopConversation.findFirst({ where: { id: parsed.data.conversationId, userId: session.userId } })
      : null;
    if (parsed.data.conversationId && !existing) return NextResponse.json({ error: "That conversation could not be found." }, { status: 404 });
    const conversation = existing
      ? await prisma.loopConversation.update({ where: { id: existing.id }, data: { level } })
      : await prisma.loopConversation.create({
          data: { userId: session.userId, level, title: titleFromMessage(text || attachments[0]?.name || "") },
        });
    await prisma.user.update({ where: { id: session.userId }, data: { loopLevel: level } }).catch(() => {});

    const userMessage = await prisma.loopMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        text,
        context: attachmentContext(attachments),
        attachments: attachments.length ? attachments.map((a) => ({ name: a.name, kind: a.kind, truncated: a.truncated ?? false })) : undefined,
      },
    });
    const assistantMessage = await prisma.loopMessage.create({ data: { conversationId: conversation.id, role: "assistant", text: "" } });

    const history = await buildHistory(conversation.id);
    // The newest user message carries this turn's pictures, which are not replayed later.
    if (history.length && history[history.length - 1].role === "user") {
      history[history.length - 1] = { role: "user", content: userContent(text, attachments) };
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sse({ type: "meta", conversationId: conversation.id, title: conversation.title, assistantMessageId: assistantMessage.id, userMessageId: userMessage.id }));
        let finalText = "";
        let toolEvents: { tool: string; label: string }[] = [];
        try {
          for await (const ev of runLoopTurn({
            userId: session.userId,
            conversationId: conversation.id,
            messageId: assistantMessage.id,
            level,
            history,
            signal: req.signal,
            studio: parsed.data.studio ?? undefined,
            scope: { userId: session.userId, role: session.role, isSuper: session.isSuper, allModules: session.scopeAll, permissions: session.permissions },
          })) {
            if (ev.type === "done") {
              finalText = ev.text;
              toolEvents = ev.toolEvents;
            }
            controller.enqueue(sse(ev));
          }
        } catch (e) {
          console.error("Loop chat turn failed:", e);
          controller.enqueue(sse({ type: "error", message: "Something went wrong. Please try again." }));
        } finally {
          await prisma.loopMessage
            .update({ where: { id: assistantMessage.id }, data: { text: finalText, toolEvents: toolEvents.length ? toolEvents : undefined } })
            .catch((e) => console.error("Failed to save Loop reply:", e));
          await prisma.loopConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
          await prisma.aiCommandLog
            .create({ data: { askedById: session.userId, question: text || "(attachment)", answer: finalText.slice(0, 4000), toolCalls: toolEvents as object } })
            .catch(() => {});
          try {
            controller.close();
          } catch {
            // the browser already left
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
    });
  });
}
