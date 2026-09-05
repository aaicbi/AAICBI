import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

/**
 * Deliberately anonymous/public — this is what the student's "enter your
 * exam code" and instructions screens call before any attempt exists.
 * Only ever return fields safe for an unauthenticated visitor: never
 * question content, option text, or anything answer-shaped. §19: don't
 * expose sensitive administrative information in the student URL/response.
 */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  return withApiErrors(async () => {
    const exam = await prisma.exam.findUnique({
      where: { code: params.code.toUpperCase() },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        instructions: true,
        durationMinutes: true,
        numQuestions: true,
        published: true,
        monitoringEnabled: true,
        _count: { select: { questions: true } },
      },
    });

    if (!exam || !exam.published) {
      return NextResponse.json(
        { error: "Examination not found, or it is not currently open." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: exam.code,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.numQuestions ?? exam._count.questions,
      monitoringEnabled: exam.monitoringEnabled,
    });
  });
}
