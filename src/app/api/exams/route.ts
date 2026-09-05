import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { createdByFilter } from "@/lib/courseOwnership";

const CreateExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  course: z.string().optional(),
  module: z.string().optional(),
  cohort: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().positive().default(60),
  passMarkPercent: z.number().int().min(0).max(100).default(80),
  numQuestions: z.number().int().positive().nullable().optional(),
  maxAttempts: z.number().int().positive().nullable().optional(),
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  showResultImmediately: z.boolean().default(true),
  showCorrectAnswers: z.boolean().default(false),
  allowReview: z.boolean().default(true),
});

function makeExamCode(title: string): string {
  const slug = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    // Whole-project audit finding: SUPER_ADMIN now sees every exam,
    // not just their own — see createdByFilter's own comment for the
    // full reasoning.
    const exams = await prisma.exam.findMany({
      where: createdByFilter(session),
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: true, attempts: true } } },
    });
    return NextResponse.json(exams);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = CreateExamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const exam = await prisma.exam.create({
      data: {
        ...parsed.data,
        code: makeExamCode(parsed.data.title),
        createdById: session.userId,
      },
    });
    return NextResponse.json(exam, { status: 201 });
  });
}
