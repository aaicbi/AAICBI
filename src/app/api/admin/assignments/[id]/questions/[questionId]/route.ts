import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignmentQuestion } from "@/lib/assignmentOwnership";

/** Prisma's Json columns need the Prisma.JsonNull sentinel to write a
 * real SQL/JSON null — a plain `null` is only valid for a relation
 * field. Every optional Json field in this route's update payload goes
 * through this before reaching Prisma. */
function jsonOrNull<T>(value: T | null | undefined): T | typeof Prisma.JsonNull | undefined {
  return value === null ? Prisma.JsonNull : value;
}

const QUESTION_TYPES = [
  "SHORT_ANSWER", "EXPLANATION", "LONG_ANSWER", "ESSAY", "SCENARIO",
  "CASE_STUDY", "PRACTICAL_TASK", "TECHNICAL_RESPONSE", "REFLECTION", "MULTI_PART",
] as const;

const UpdateQuestionSchema = z.object({
  section: z.string().nullable().optional(),
  questionNumber: z.string().min(1).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  questionText: z.string().min(1).optional(),
  instructions: z.string().nullable().optional(),
  referenceMaterial: z.string().nullable().optional(),
  expectedAnswer: z.string().nullable().optional(),
  expectedConcepts: z.array(z.string()).nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  learningObjective: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  maxMarks: z.number().int().positive().optional(),
  rubric: z.array(z.object({ name: z.string(), maxMarks: z.number().int().positive(), description: z.string().nullable() })).nullable().optional(),
  order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { questionId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignmentQuestion(params.questionId, session.userId, session.role);

    const body = await req.json();
    const parsed = UpdateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Editing a question by hand is exactly what resolves whatever the
    // AI extraction step flagged it for — same "an instructor's own
    // edit clears needsReview" reasoning as the create route.
    const updated = await prisma.assignmentQuestion.update({
      where: { id: params.questionId },
      data: {
        ...parsed.data,
        expectedConcepts: jsonOrNull(parsed.data.expectedConcepts),
        keywords: jsonOrNull(parsed.data.keywords),
        rubric: jsonOrNull(parsed.data.rubric),
        needsReview: false,
        reviewReason: null,
      },
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { questionId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignmentQuestion(params.questionId, session.userId, session.role);

    const answerCount = await prisma.assignmentAnswer.count({ where: { questionId: params.questionId } });
    if (answerCount > 0) {
      return NextResponse.json(
        { error: "Trainees have already answered this question, so it can't be deleted. Unpublish the assignment first if you need to restructure it." },
        { status: 409 }
      );
    }

    await prisma.assignmentQuestion.delete({ where: { id: params.questionId } });
    return NextResponse.json({ ok: true });
  });
}
