import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";
import { validateAssignmentQuestions, hasBlockingIssues } from "@/lib/assignmentValidation";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { assignmentPublishedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

/**
 * POST /api/admin/assignments/[id]/publish — runs assignmentValidation.ts
 * (§22) first; a hard blocker (a question with no mark allocation)
 * refuses to publish at all. A warning-only issue list is returned
 * alongside the successful publish — shown to the instructor, never
 * silently hidden, but never blocking.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const questions = await prisma.assignmentQuestion.findMany({ where: { assignmentId: params.id } });
    if (questions.length === 0) {
      return NextResponse.json({ error: "Add at least one question before publishing." }, { status: 400 });
    }

    const issues = validateAssignmentQuestions(questions);
    if (hasBlockingIssues(issues)) {
      return NextResponse.json({ error: "This assignment has structural issues that must be fixed before publishing.", issues }, { status: 400 });
    }

    const assignment = await prisma.assignment.update({ where: { id: params.id }, data: { status: "PUBLISHED" } });

    // Notify every trainee currently enrolled in the owning course (or
    // the module's own course) — best-effort, never blocks the publish
    // itself. Module/course-less "library" assignments have no
    // audience yet, so nothing to notify.
    const courseId = assignment.courseId ?? (await prisma.module.findUnique({ where: { id: assignment.moduleId ?? "" }, select: { courseId: true } }))?.courseId;
    if (courseId) {
      const enrolled = await prisma.courseEnrollment.findMany({
        where: { courseId, unlockedAt: { not: null }, accessRevokedAt: null },
        select: { trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } } },
      });
      for (const { trainee } of enrolled) {
        if (!shouldNotifyTrainee(trainee)) continue;
        const content = assignmentPublishedEmail({
          traineeName: trainee.name,
          assignmentTitle: assignment.title,
          dueDateLabel: assignment.dueAt ? assignment.dueAt.toLocaleDateString() : null,
          assignmentUrl: appUrl(`/trainee/assignments/${assignment.id}`),
        });
        await notifyByEmail({
          recipientType: "TRAINEE",
          recipientId: trainee.id,
          to: trainee.email,
          type: "ASSIGNMENT_PUBLISHED",
          relatedId: assignment.id,
          url: `/trainee/assignments/${assignment.id}`,
          subject: content.subject,
          html: content.html,
          text: content.text,
        }).catch((e) => console.error(`Failed to notify trainee ${trainee.id} of new assignment ${assignment.id}:`, e));
      }
    }

    return NextResponse.json({ assignment, issues });
  });
}
