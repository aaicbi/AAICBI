import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";

const QUESTION_TYPES = [
  "SHORT_ANSWER", "EXPLANATION", "LONG_ANSWER", "ESSAY", "SCENARIO",
  "CASE_STUDY", "PRACTICAL_TASK", "TECHNICAL_RESPONSE", "REFLECTION", "MULTI_PART",
] as const;

const CreateQuestionSchema = z.object({
  section: z.string().nullable().optional(),
  questionNumber: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  questionText: z.string().min(1),
  instructions: z.string().nullable().optional(),
  referenceMaterial: z.string().nullable().optional(),
  expectedAnswer: z.string().nullable().optional(),
  expectedConcepts: z.array(z.string()).nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  learningObjective: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  maxMarks: z.number().int().positive(),
  rubric: z.array(z.object({ name: z.string(), maxMarks: z.number().int().positive(), description: z.string().nullable() })).nullable().optional(),
});

/**
 * POST /api/admin/assignments/[id]/questions — adds a question by hand
 * (the admin review/edit screen's "+ Add Question" action), appended
 * after every existing question. Clears needsReview — a question an
 * instructor just wrote or edited by hand is, by definition, no longer
 * something the AI extraction step needs a human to double-check.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);

    const body = await req.json();
    const parsed = CreateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const maxOrder = await prisma.assignmentQuestion.aggregate({
      where: { assignmentId: params.id },
      _max: { order: true },
    });

    const question = await prisma.assignmentQuestion.create({
      data: {
        assignmentId: params.id,
        section: parsed.data.section,
        questionNumber: parsed.data.questionNumber,
        type: parsed.data.type,
        questionText: parsed.data.questionText,
        instructions: parsed.data.instructions,
        referenceMaterial: parsed.data.referenceMaterial,
        expectedAnswer: parsed.data.expectedAnswer,
        expectedConcepts: parsed.data.expectedConcepts ?? undefined,
        keywords: parsed.data.keywords ?? undefined,
        learningObjective: parsed.data.learningObjective,
        difficulty: parsed.data.difficulty,
        maxMarks: parsed.data.maxMarks,
        rubric: parsed.data.rubric ?? undefined,
        order: (maxOrder._max.order ?? -1) + 1,
        needsReview: false,
        reviewReason: null,
      },
    });
    return NextResponse.json(question, { status: 201 });
  });
}
