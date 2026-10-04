import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { gradeOrRouteSubmission } from "@/lib/assignmentGrading";

/**
 * POST /api/trainee/assignments/[id]/submit — the atomic submit (§9):
 * save all answers (already true by the time this is called, via the
 * autosave route), create/mark the submission record, prevent
 * accidental duplicate submission, send it for assessment, notify the
 * trainee it's being processed.
 *
 * Same atomic-updateMany idempotency guard examEngine.ts's own
 * submitAttempt uses: `status: { not: "SUBMITTED" }` ... wider, in
 * `{ in: ["IN_PROGRESS"] }` form — only ONE concurrent caller can ever
 * have `count === 1`, so a double-click or a network retry can never
 * trigger grading twice for the same submission.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, dueAt: true, lateSubmissionPolicy: true },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
    });
    if (!submission) {
      return NextResponse.json({ error: "Open the assignment and answer at least one question before submitting." }, { status: 400 });
    }

    const isLate = !!assignment.dueAt && new Date() > assignment.dueAt;
    if (isLate && assignment.lateSubmissionPolicy === "NOT_ALLOWED") {
      return NextResponse.json({ error: "The due date for this assignment has passed and late submissions aren't allowed." }, { status: 400 });
    }

    const claimed = await prisma.assignmentSubmission.updateMany({
      where: { id: submission.id, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: new Date(), isLate: isLate && assignment.lateSubmissionPolicy === "ALLOWED_WITH_FLAG" },
    });
    if (claimed.count === 0) {
      // Lost the race, or already submitted earlier — either way,
      // honest feedback, not a silent no-op or a duplicate grading run.
      return NextResponse.json({ error: "This assignment has already been submitted." }, { status: 409 });
    }

    // Grading itself must never block the trainee's own "submitted"
    // response — if it throws for any genuinely unexpected reason, the
    // submission still stands as SUBMITTED, and a staff member can
    // re-trigger grading manually. Mirrors the same "submission is
    // already committed above this line" discipline examEngine.ts's
    // own comment describes for its post-grading AI analysis step.
    try {
      await gradeOrRouteSubmission(submission.id);
    } catch (e) {
      console.error(`Grading/routing failed for submission ${submission.id}:`, e);
    }

    return NextResponse.json({ submitted: true, submissionId: submission.id });
  });
}
