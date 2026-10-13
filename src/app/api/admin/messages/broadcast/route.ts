import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import type { RecipientFilter } from "@/lib/messaging/recipients";
import { sendLoopBroadcast } from "@/lib/messaging/loopBroadcast";

/**
 * POST /api/admin/messages/broadcast — the ONE place a Loop broadcast
 * is actually sent. Deliberately under a top-level `messages` namespace
 * rather than nested under `/admin/loop/*`: this is genuinely reusable
 * platform-level communication infrastructure (see
 * src/lib/messaging/broadcast.ts's own comment), not something wired
 * specifically to one Loop command.
 *
 * This file is the literal, structural enforcement of "Loop only
 * proposes, a human sends": there is no Anthropic import anywhere here,
 * no reasoning, no AI call of any kind. It fires only when the Super
 * Admin's own browser calls it — which only happens from the confirm
 * card's Send button in src/app/admin/command/page.tsx, after
 * POST /api/admin/loop/ask already returned a `{kind: "proposal", ...}`
 * for the admin to review.
 *
 * Two things this route refuses to trust from the request body, on
 * purpose:
 *   - The recipient LIST. Only `recipientFilter` (a description of a
 *     group, e.g. "role = INSTRUCTOR") is accepted; this route re-runs
 *     resolveRecipients() itself against the live database rather than
 *     trusting any id list a client could have sent, stale or forged.
 *   - Who authorized the send. `authorizedById` is always session.userId
 *     — never read from the body — and `senderLabel` is always the
 *     server-side constant below, never client-supplied. That's the
 *     actual mechanism behind "the recipient never sees the Super
 *     Admin's real identity, but it's always in the audit record":
 *     the two are structurally different fields, and only one of them
 *     is ever attacker- or model-influenced in the first place (and
 *     even it isn't, here).
 */
export const maxDuration = 60;

const RecipientFilterSchema: z.ZodType<RecipientFilter> = z.union([
  z.object({
    scope: z.literal("INDIVIDUALS"),
    refs: z.array(z.object({ type: z.enum(["TRAINEE", "STAFF", "EMPLOYER"]), id: z.string() })),
  }),
  z.object({ scope: z.literal("COURSE"), courseQuery: z.string() }),
  z.object({ scope: z.literal("COHORT"), cohortQuery: z.string() }),
  z.object({ scope: z.literal("ROLE"), role: z.enum(["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]) }),
  z.object({ scope: z.literal("ALL_TRAINEES") }),
  z.object({ scope: z.literal("ALL_STAFF") }),
  z.object({ scope: z.literal("ALL_EMPLOYERS") }),
  z.object({ scope: z.literal("EVERYONE") }),
]);

const BroadcastSchema = z.object({
  recipientFilter: RecipientFilterSchema,
  recipientDescription: z.string().trim().min(1).max(200),
  recipientCountExpected: z.number().int().min(0),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(60),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`loop-broadcast:${session.userId}:${clientIp(req)}`, 10, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many messages sent in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = BroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid message proposal." }, { status: 400 });
    }
    const { recipientFilter, recipientDescription, recipientCountExpected, subject, body: messageBody, category } = parsed.data;

    // Never trust a stored/passed id list: the helper resolves fresh, right
    // now, against the live database. `authorizedById` is the session user.
    const result = await sendLoopBroadcast({
      authorizedById: session.userId,
      recipientFilter,
      recipientDescription,
      recipientCountExpected,
      subject,
      body: messageBody,
      category,
    });

    return NextResponse.json(result);
  });
}
