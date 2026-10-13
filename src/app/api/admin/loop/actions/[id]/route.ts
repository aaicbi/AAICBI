import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { executeLoopAction, rejectLoopAction } from "@/lib/loop/runAction";

const Body = z.object({ decision: z.enum(["approve", "reject"]) });

/**
 * POST /api/admin/loop/actions/[id] — the person's own decision on an action
 * card. SUPER_ADMIN only, and only for an action recorded in one of their own
 * chats. Approving runs exactly the validated input that was recorded.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Approve or reject." }, { status: 400 });
    const card =
      parsed.data.decision === "approve"
        ? await executeLoopAction(params.id, session.userId, { auto: false })
        : await rejectLoopAction(params.id, session.userId);
    return NextResponse.json(card);
  });
}
