import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";

/**
 * POST /api/modules/[id]/assessment/publish — the module-scoped twin of
 * POST /api/exams/[id]/publish. Same §11 rule, enforced the same way:
 * no publish while any question in the bank still needs review, and no
 * publish with an empty bank. This is the gate a trainee's "Take
 * Assessment" button in the course view depends on — GET
 * /api/modules/[id]/assessment already 404s a trainee on an
 * unpublished assessment, so this is the only door that opens it.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId);

    const exam = await prisma.exam.findUnique({
      where: { moduleId: params.id },
      include: { questions: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "This module doesn't have an assessment yet." }, { status: 404 });
    }

    const outstanding = exam.questions.filter((q: { needsReview: boolean }) => q.needsReview);
    if (outstanding.length > 0) {
      return NextResponse.json(
        {
          error: `${outstanding.length} question(s) still need review before this assessment can be published.`,
          outstandingQuestionIds: outstanding.map((q: { id: string }) => q.id),
        },
        { status: 409 }
      );
    }
    if (exam.questions.length === 0) {
      return NextResponse.json({ error: "Add at least one question before publishing." }, { status: 409 });
    }

    const updated = await prisma.exam.update({
      where: { moduleId: params.id },
      data: { published: true },
    });
    return NextResponse.json(updated);
  });
}
