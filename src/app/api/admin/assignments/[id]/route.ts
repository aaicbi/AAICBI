import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);
    const assignment = await prisma.assignment.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        module: { select: { id: true, title: true } },
        course: { select: { id: true, title: true } },
        questions: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
      },
    });
    return NextResponse.json(assignment);
  });
}

const UpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  moduleId: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  lateSubmissionPolicy: z.enum(["ALLOWED", "ALLOWED_WITH_FLAG", "NOT_ALLOWED"]).optional(),
  allowEditAfterSubmission: z.boolean().optional(),
  aiAssessmentEnabled: z.boolean().optional(),
  resubmissionPolicy: z.enum(["NONE", "ONE", "LIMITED", "UNLIMITED"]).optional(),
  maxResubmissions: z.number().int().positive().nullable().optional(),
  resubmissionScope: z.enum(["FULL_ASSIGNMENT", "FAILED_QUESTIONS_ONLY"]).optional(),
  failedQuestionThresholdPercent: z.number().int().min(1).max(99).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.assignment.update({
      where: { id: params.id },
      data: parsed.data,
      include: { questions: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const submissionCount = await prisma.assignmentSubmission.count({ where: { assignmentId: params.id } });
    if (submissionCount > 0) {
      return NextResponse.json(
        { error: "This assignment has real trainee submissions and can't be deleted. Unpublish it instead." },
        { status: 409 }
      );
    }

    await prisma.assignment.delete({ where: { id: params.id } }); // cascades to questions
    return NextResponse.json({ ok: true });
  });
}
