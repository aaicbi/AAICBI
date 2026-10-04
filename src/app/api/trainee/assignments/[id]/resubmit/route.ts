import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/trainee/assignments/[id]/resubmit — creates the next
 * attempt (§18), respecting the assignment's own resubmissionPolicy.
 * Phase 1 always starts the new attempt with the FULL assignment's
 * worth of fresh, empty answers — resubmissionScope's
 * FAILED_QUESTIONS_ONLY distinction is schema-ready but not yet
 * enforced here (see the plan's own "explicitly deferred" section).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, resubmissionPolicy: true, maxResubmissions: true },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (assignment.resubmissionPolicy === "NONE") {
      return NextResponse.json({ error: "This assignment doesn't allow resubmission." }, { status: 400 });
    }

    const latest = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
    });
    if (!latest) {
      return NextResponse.json({ error: "No existing submission to resubmit." }, { status: 400 });
    }
    if (latest.status === "IN_PROGRESS") {
      return NextResponse.json({ error: "Your current attempt isn't submitted yet — submit it first." }, { status: 400 });
    }

    const priorAttempts = latest.attemptNumber;
    const limit =
      assignment.resubmissionPolicy === "ONE" ? 2 : assignment.resubmissionPolicy === "LIMITED" ? 1 + (assignment.maxResubmissions ?? 0) : null;
    if (limit !== null && priorAttempts >= limit) {
      return NextResponse.json({ error: "You've used all the resubmission attempts allowed for this assignment." }, { status: 400 });
    }

    const nextSubmission = await prisma.assignmentSubmission.create({
      data: { assignmentId: params.id, traineeId: session.userId, attemptNumber: priorAttempts + 1, status: "IN_PROGRESS" },
    });
    return NextResponse.json({ submission: nextSubmission });
  });
}
