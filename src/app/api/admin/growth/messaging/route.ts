import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { MessagingError, markManualSent, messagingOverview, processMessages, resetTemplate, retryMessage, saveTemplate, skipMessage, updateMessagingSettings } from "@/lib/growth/messaging";

export const dynamic = "force-dynamic";

/** GET — messaging settings, what is set up on this server, message texts, counts and the latest messages. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await messagingOverview());
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean().optional(), channel: z.string().optional(), dailyCap: z.union([z.number(), z.string()]).optional(), quiet: z.object({ start: z.number(), end: z.number() }).optional() }),
  z.object({ action: z.literal("template"), kind: z.string().max(40), body: z.string().max(2000), waTemplate: z.string().max(520).optional() }),
  z.object({ action: z.literal("resetTemplate"), kind: z.string().max(40) }),
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("sent"), id: z.string().min(1).max(60) }),
  z.object({ action: z.literal("skip"), id: z.string().min(1).max(60) }),
  z.object({ action: z.literal("retry"), id: z.string().min(1).max(60) }),
]);

/** POST — change the settings or message texts, send what is due now, or deal with one message. Super Admin only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      let run: Awaited<ReturnType<typeof processMessages>> | null = null;
      if (b.action === "settings") await updateMessagingSettings(s.userId, { enabled: b.enabled, channel: b.channel, dailyCap: b.dailyCap, quiet: b.quiet });
      else if (b.action === "template") await saveTemplate(s.userId, b.kind, { body: b.body, waTemplate: b.waTemplate });
      else if (b.action === "resetTemplate") await resetTemplate(s.userId, b.kind);
      else if (b.action === "run") run = await processMessages();
      else if (b.action === "sent") await markManualSent(s.userId, b.id);
      else if (b.action === "skip") await skipMessage(s.userId, b.id);
      else await retryMessage(s.userId, b.id);
      return NextResponse.json({ ...(await messagingOverview()), run });
    } catch (e) {
      if (e instanceof MessagingError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
