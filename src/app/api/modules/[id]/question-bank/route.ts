import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/modules/[id]/question-bank — everything the unified gate
 * 1/gate 2 review page needs in one call: the module's confirmed
 * objectives (for context and the "generate more" flow), and every
 * question currently sitting at PENDING_REVIEW (gate 1) or one of the
 * three non-pass validated statuses (gate 2). SUPER_ADMIN only, no
 * ownership check — same confirmed decision as every other new route
 * in this feature.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const targetModule = await prisma.module.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, course: { select: { title: true } } },
    });
    if (!targetModule) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    const objectives = await prisma.moduleLearningObjective.findMany({
      where: { moduleId: params.id },
      select: { id: true, text: true, order: true },
      orderBy: { order: "asc" },
    });

    const exam = await prisma.exam.findUnique({ where: { moduleId: params.id }, select: { id: true } });

    const questionSelect = {
      id: true,
      text: true,
      topic: true,
      explanation: true,
      bankStatus: true,
      options: { select: { id: true, text: true, isCorrect: true }, orderBy: { key: "asc" as const } },
      bankObjective: { select: { id: true, text: true } },
      sourceMaterials: { select: { material: { select: { title: true } } } },
      bankEvents: { orderBy: { createdAt: "desc" as const }, take: 1, select: { detail: true, note: true, createdAt: true } },
    };

    const [gate1, gate2] = exam
      ? await Promise.all([
          prisma.question.findMany({ where: { examId: exam.id, bankStatus: "PENDING_REVIEW" }, select: questionSelect, orderBy: { createdAt: "asc" } }),
          prisma.question.findMany({
            where: { examId: exam.id, bankStatus: { in: ["VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] } },
            select: questionSelect,
            orderBy: { createdAt: "asc" },
          }),
        ])
      : [[], []];

    return NextResponse.json({
      module: { id: targetModule.id, title: targetModule.title, courseTitle: targetModule.course.title },
      objectives,
      examId: exam?.id ?? null,
      gate1,
      gate2,
    });
  });
}
