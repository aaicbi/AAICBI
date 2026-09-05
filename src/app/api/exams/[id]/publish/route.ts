import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam } from "@/lib/courseOwnership";

/**
 * §11: "Do not publish the examination until questions with critical
 * errors have been reviewed." Enforced server-side, not just hidden in
 * the UI — the publish button being disabled client-side isn't enough,
 * since someone could hit this route directly.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedExam(params.id, session.userId); // M11 audit finding — see courseOwnership.ts

    const exam = await prisma.exam.findUniqueOrThrow({
      where: { id: params.id },
      include: { questions: true },
    });

    const outstanding = exam.questions.filter((q) => q.needsReview);
    if (outstanding.length > 0) {
      return NextResponse.json(
        {
          error: `${outstanding.length} question(s) still need review before this exam can be published.`,
          outstandingQuestionIds: outstanding.map((q) => q.id),
        },
        { status: 409 }
      );
    }
    if (exam.questions.length === 0) {
      return NextResponse.json({ error: "Add at least one question before publishing." }, { status: 409 });
    }

    const updated = await prisma.exam.update({
      where: { id: params.id },
      data: { published: true },
    });
    return NextResponse.json(updated);
  });
}
