import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { assignmentResubmissionRequestedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

/**
 * GET — the instructor review detail: question, student answer,
 * expected answer, rubric, AI score/feedback/confidence, side by side.
 * This IS a staff route, so (unlike every trainee-facing lookup) the
 * full question row — including expectedAnswer/rubric — is exactly
 * what should be returned here.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string; submissionId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: params.submissionId },
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        instructorReviewedBy: { select: { name: true } },
        answers: { include: { question: true } },
      },
    });
    if (!submission || submission.assignmentId !== params.id) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json(submission);
  });
}

const OverrideSchema = z.object({
  answerOverrides: z
    .array(
      z.object({
        answerId: z.string(),
        instructorScore: z.number().int().min(0).nullable(),
        instructorFeedback: z.string().nullable().optional(),
      })
    )
    .optional(),
  instructorComments: z.string().nullable().optional(),
  decision: z.enum(["ACCEPTED_AI_SCORE", "SCORE_ADJUSTED", "RETURNED", "RESUBMISSION_REQUIRED"]),
});

/**
 * PATCH — the instructor's own decision on a submission (§17): accept
 * the AI score as-is, adjust one or more question scores/feedback,
 * return it, or request a resubmission. The instructor's final score
 * (instructorScore ?? aiScore per question, summed) becomes the
 * submission's official totalScore/percentage the moment this runs —
 * "AI Score: 7/10, Instructor Score: 8/10" (§17's own example) is
 * exactly what the two separate column pairs on AssignmentAnswer
 * already represent; this route is what actually finalizes it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; submissionId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const body = await req.json();
    const parsed = OverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: params.submissionId },
      include: { trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } }, answers: { include: { question: true } } },
    });
    if (!submission || submission.assignmentId !== params.id) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    for (const override of parsed.data.answerOverrides ?? []) {
      const answer = submission.answers.find((a) => a.id === override.answerId);
      if (!answer) {
        return NextResponse.json({ error: "One of the submitted answers doesn't belong to this submission." }, { status: 400 });
      }
      if (override.instructorScore !== null && answer.question.maxMarks < override.instructorScore) {
        return NextResponse.json({ error: `Score for question ${answer.question.questionNumber} can't exceed its ${answer.question.maxMarks} marks.` }, { status: 400 });
      }
      await prisma.assignmentAnswer.update({
        where: { id: override.answerId },
        data: { instructorScore: override.instructorScore, instructorFeedback: override.instructorFeedback },
      });
    }

    const freshAnswers = await prisma.assignmentAnswer.findMany({
      where: { submissionId: submission.id },
      include: { question: { select: { maxMarks: true } } },
    });
    const finalScore = freshAnswers.reduce((sum, a) => sum + (a.instructorScore ?? a.aiScore ?? 0), 0);
    const maxScore = freshAnswers.reduce((sum, a) => sum + a.question.maxMarks, 0);
    const percentage = maxScore > 0 ? (finalScore / maxScore) * 100 : 0;

    const newStatus =
      parsed.data.decision === "RETURNED"
        ? "RETURNED"
        : parsed.data.decision === "RESUBMISSION_REQUIRED"
          ? "RESUBMISSION_REQUIRED"
          : "INSTRUCTOR_REVIEWED";

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: newStatus,
        totalScore: finalScore,
        maxScore,
        percentage,
        instructorReviewedById: session.userId,
        instructorReviewedAt: new Date(),
        instructorComments: parsed.data.instructorComments,
        instructorDecision: parsed.data.decision,
      },
    });

    if (parsed.data.decision === "RESUBMISSION_REQUIRED" && shouldNotifyTrainee(submission.trainee)) {
      const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: params.id }, select: { title: true } });
      const content = assignmentResubmissionRequestedEmail({
        traineeName: submission.trainee.name,
        assignmentTitle: assignment.title,
        comments: parsed.data.instructorComments ?? null,
        assignmentUrl: appUrl(`/trainee/assignments/${params.id}`),
      });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: submission.trainee.id,
        to: submission.trainee.email,
        type: "ASSIGNMENT_RESUBMISSION_REQUESTED",
        relatedId: submission.id,
        url: `/trainee/assignments/${params.id}`,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Failed to send resubmission-requested notification for submission ${submission.id}:`, e));
    }

    return NextResponse.json(updated);
  });
}
