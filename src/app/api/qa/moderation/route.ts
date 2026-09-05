import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { issueQaWarning, issueQaSuspension, reinstateQaAccess } from "@/lib/qaModeration";

const ModerateSchema = z.object({
  threadId: z.string(),
  traineeId: z.string(),
  action: z.enum(["WARNING", "SUSPENSION", "REINSTATEMENT"]),
  reason: z.string().trim().min(1),
});

/**
 * POST /api/qa/moderation — the real staff-facing action behind M41's
 * moderation scope. Deliberately requires a `threadId`, not just a
 * bare `traineeId` — course ownership is checked through the thread's
 * own course, the same discipline every staff-facing route in this
 * project already applies, and requiring the trainee to actually be a
 * real author in THIS thread is a genuine safety constraint, not
 * incidental: it keeps this action tied to an actual post staff is
 * looking at, rather than an arbitrary trainee ID a compromised
 * session or a UI bug could otherwise target.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const body = await req.json();
    const parsed = ModerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { threadId, traineeId, action, reason } = parsed.data;

    const thread = await prisma.qaThread.findUnique({
      where: { id: threadId },
      select: {
        lesson: { select: { module: { select: { course: { select: { createdById: true } } } } } },
        posts: { where: { authorType: "TRAINEE", authorId: traineeId }, select: { id: true }, take: 1 },
      },
    });
    if (!thread || thread.lesson.module.course.createdById !== session.userId) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    if (thread.posts.length === 0) {
      return NextResponse.json({ error: "That trainee hasn't posted in this thread." }, { status: 400 });
    }

    if (action === "WARNING") {
      const result = await issueQaWarning(traineeId, session.userId, reason);
      return NextResponse.json({ ok: true, autoSuspended: result.suspended });
    }
    if (action === "SUSPENSION") {
      const result = await issueQaSuspension(traineeId, session.userId, reason);
      return NextResponse.json({ ok: true, alreadySuspended: !result.changed });
    }
    const result = await reinstateQaAccess(traineeId, session.userId, reason);
    return NextResponse.json({ ok: true, wasNotSuspended: !result.changed });
  });
}
