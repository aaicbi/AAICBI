import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { issueMessagingSuspension, reinstateMessagingAccess } from "@/lib/messagingModeration";

const BodySchema = z.object({
  action: z.enum(["SUSPEND", "REINSTATE"]),
  reason: z.string().trim().min(1),
});

/**
 * POST /api/admin/trainees/[id]/messaging-suspension — SUPER_ADMIN only,
 * on purpose (not ADMIN/INSTRUCTOR too, unlike QA moderation's
 * requireRole("SUPER_ADMIN","ADMIN","INSTRUCTOR")) — this is a
 * platform-wide action affecting a trainee's ability to message anyone,
 * not a single course-owner's call. See the messaging system's own
 * schema comment on MessagingModerationAction for why this deliberately
 * doesn't reuse QaModerationAction's own suspend/reinstate route.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "An action and reason are required." }, { status: 400 });

    if (parsed.data.action === "SUSPEND") {
      const result = await issueMessagingSuspension(params.id, session.userId, parsed.data.reason);
      return NextResponse.json({ ok: true, alreadySuspended: !result.changed });
    }
    const result = await reinstateMessagingAccess(params.id, session.userId, parsed.data.reason);
    return NextResponse.json({ ok: true, wasNotSuspended: !result.changed });
  });
}
