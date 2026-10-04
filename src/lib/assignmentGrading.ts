/**
 * AI Assignment Engine — the submit-time orchestration. Called once
 * from POST /api/trainee/assignments/[id]/submit, after the submission
 * itself has already been atomically marked SUBMITTED. Branches on
 * Assignment.aiAssessmentEnabled (settled during planning): on, every
 * answer goes through assessAssignmentAnswer.ts sequentially (same
 * "sequential, not parallel, for predictable rate-limit behavior"
 * reasoning as extractQuestionsBatch); off, the whole submission is
 * rendered as a PDF and emailed to the owning instructor for manual
 * grading — no AI call happens at all in that path.
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { assessAssignmentAnswer } from "@/lib/ai/assessAssignmentAnswer";
import { generateAssignmentOverallFeedback, type PerQuestionResult } from "@/lib/ai/generateAssignmentOverallFeedback";
import { renderAssignmentSubmissionPdf } from "@/lib/assignmentSubmissionPdf";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import {
  assignmentSubmittedToInstructorEmail,
  assignmentAssessedEmail,
} from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

type SubmissionWithRelations = NonNullable<Awaited<ReturnType<typeof loadSubmission>>>;
function loadSubmission(id: string) {
  return prisma.assignmentSubmission.findUnique({
    where: { id },
    include: {
      assignment: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
      trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } },
      answers: { include: { question: true } },
    },
  });
}

export async function gradeOrRouteSubmission(submissionId: string): Promise<void> {
  const submission = await loadSubmission(submissionId);
  if (!submission) {
    console.error(`gradeOrRouteSubmission: submission ${submissionId} not found.`);
    return;
  }

  if (submission.assignment.aiAssessmentEnabled) {
    await runAiGrading(submission);
  } else {
    await routeToManualGrading(submission);
  }
}

async function runAiGrading(submission: SubmissionWithRelations): Promise<void> {
  await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { status: "ASSESSMENT_PENDING" } });

  let anyPending = false;
  const perQuestionResults: PerQuestionResult[] = [];

  for (const answer of submission.answers) {
    const q = answer.question;
    const result = await assessAssignmentAnswer({
      questionText: q.questionText,
      questionType: q.type,
      instructions: q.instructions,
      expectedAnswer: q.expectedAnswer,
      expectedConcepts: Array.isArray(q.expectedConcepts) ? (q.expectedConcepts as string[]) : null,
      rubric: Array.isArray(q.rubric) ? (q.rubric as { name: string; maxMarks: number; description: string | null }[]) : null,
      maxMarks: q.maxMarks,
      answerText: answer.answerText ?? "",
    });

    if (result.ok) {
      const a = result.assessment;
      await prisma.assignmentAnswer.update({
        where: { id: answer.id },
        data: {
          aiScore: a.score,
          aiMaxScore: a.maximum_score,
          aiPercentage: a.maximum_score > 0 ? (a.score / a.maximum_score) * 100 : 0,
          aiCriteriaScores: a.criteria,
          aiStrengths: a.strengths,
          aiAreasForImprovement: a.areas_for_improvement,
          aiFeedback: a.feedback,
          aiConfidence: a.confidence,
          aiNeedsInstructorReview: a.needs_instructor_review,
          aiRawOutput: a as object,
          aiAssessedAt: new Date(),
        },
      });
      perQuestionResults.push({
        questionNumber: q.questionNumber,
        score: a.score,
        maxScore: a.maximum_score,
        strengths: a.strengths,
        areasForImprovement: a.areas_for_improvement,
      });
    } else {
      // Never a fabricated or zeroed grade — this answer stays
      // unscored and the whole submission routes to instructor review.
      console.error(`AI assessment failed for answer ${answer.id} (question ${q.questionNumber}): ${result.reason}`);
      await prisma.assignmentAnswer.update({
        where: { id: answer.id },
        data: { aiNeedsInstructorReview: true },
      });
      anyPending = true;
      perQuestionResults.push({ questionNumber: q.questionNumber, score: null, maxScore: q.maxMarks, strengths: [], areasForImprovement: [] });
    }
  }

  const scored = perQuestionResults.filter((r) => r.score !== null);
  const totalScore = scored.reduce((sum, r) => sum + (r.score ?? 0), 0);
  const maxScore = submission.answers.reduce((sum, a) => sum + a.question.maxMarks, 0);
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  const overall = await generateAssignmentOverallFeedback(perQuestionResults);

  await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      status: anyPending ? "ASSESSMENT_PENDING" : "AI_ASSESSED",
      totalScore,
      maxScore,
      percentage,
      overallFeedback: overall?.feedback ?? null,
      overallStrengths: overall?.strengths ?? Prisma.JsonNull,
      overallAreasForImprovement: overall?.areasForImprovement ?? Prisma.JsonNull,
    },
  });

  if (shouldNotifyTrainee(submission.trainee)) {
    const content = assignmentAssessedEmail({
      traineeName: submission.trainee.name,
      assignmentTitle: submission.assignment.title,
      pending: anyPending,
      resultUrl: appUrl(`/trainee/assignments/${submission.assignmentId}/result`),
    });
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: submission.trainee.id,
      to: submission.trainee.email,
      type: "ASSIGNMENT_ASSESSED",
      relatedId: submission.id,
      url: `/trainee/assignments/${submission.assignmentId}/result`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }).catch((e) => console.error(`Failed to send assignment-assessed notification for submission ${submission.id}:`, e));
  }
}

async function routeToManualGrading(submission: SubmissionWithRelations): Promise<void> {
  await prisma.assignmentSubmission.update({ where: { id: submission.id }, data: { status: "MANUAL_PENDING" } });

  let pdfAttachment: { filename: string; content: Buffer }[] | undefined;
  try {
    const pdf = await renderAssignmentSubmissionPdf({
      assignmentTitle: submission.assignment.title,
      traineeName: submission.trainee.name,
      submittedAt: submission.submittedAt ?? new Date(),
      questions: submission.answers.map((a) => ({
        questionNumber: a.question.questionNumber,
        questionText: a.question.questionText,
        maxMarks: a.question.maxMarks,
        answerText: a.answerText,
      })),
    });
    pdfAttachment = [{ filename: `${submission.assignment.title.replace(/\s+/g, "-")}-${submission.trainee.name.replace(/\s+/g, "-")}.pdf`, content: pdf }];
  } catch (e) {
    console.error(`Failed to render submission PDF for submission ${submission.id}:`, e);
  }

  const instructor = submission.assignment.createdBy;
  const content = assignmentSubmittedToInstructorEmail({
    instructorName: instructor.name,
    traineeName: submission.trainee.name,
    assignmentTitle: submission.assignment.title,
    submissionsUrl: appUrl(`/admin/assignments/${submission.assignmentId}/submissions`),
  });
  await notifyByEmail({
    recipientType: "STAFF",
    recipientId: instructor.id,
    to: instructor.email,
    type: "ASSIGNMENT_SUBMITTED",
    relatedId: submission.id,
    url: `/admin/assignments/${submission.assignmentId}/submissions`,
    subject: content.subject,
    html: content.html,
    text: content.text,
    attachments: pdfAttachment,
  }).catch((e) => console.error(`Failed to send manual-grading notification for submission ${submission.id}:`, e));

  if (shouldNotifyTrainee(submission.trainee)) {
    const traineeContent = assignmentAssessedEmail({
      traineeName: submission.trainee.name,
      assignmentTitle: submission.assignment.title,
      pending: true,
      resultUrl: appUrl(`/trainee/assignments/${submission.assignmentId}/result`),
    });
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: submission.trainee.id,
      to: submission.trainee.email,
      type: "ASSIGNMENT_ASSESSED",
      relatedId: submission.id,
      url: `/trainee/assignments/${submission.assignmentId}/result`,
      subject: traineeContent.subject,
      html: traineeContent.html,
      text: traineeContent.text,
    }).catch((e) => console.error(`Failed to send submission-received notification for submission ${submission.id}:`, e));
  }
}
