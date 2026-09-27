import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { startAttempt, serveableQuestion, secondsRemaining } from "@/lib/examEngine";

// M9 change from the CBT scaffold: this used to be reachable anonymously,
// creating a fresh Student record per attempt from whatever the taker
// typed on a login screen. Attempts now require a real, logged-in
// Trainee — requireRole("TRAINEE") replaces the old anonymous-entry
// pattern.
//
// M11 update: this by-code entry flow is kept, not replaced — it's the
// right path for a standalone exam that was never attached to a
// course (an Exam with moduleId === null; the admin/exams/new UI still
// creates these). A module-scoped assessment now has its own parallel
// start route instead, POST /api/modules/[id]/attempts, reached from
// inside a course rather than by typing a code — see that route's
// comment for why it's a separate file rather than a branch in this
// one.
//
// Standalone-exam access control: the gap this comment used to flag
// ("a trainee ever needs to be blocked from starting a by-code attempt
// against an exam that IS module-scoped... nothing here prevents it")
// is closed below, at the same time as the real feature request that
// prompted closing it — a standalone exam is only startable by a
// trainee with a non-revoked ExamAccessGrant (see GET
// /api/exams/by-code/[code]'s own comment for the parallel check on
// the metadata screen this attempt follows).
const StartAttemptSchema = z.object({
  examCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = StartAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid exam code." }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({
      where: { code: parsed.data.examCode },
      include: { questions: { include: { options: true } } },
    });
    if (!exam || exam.courseId || exam.moduleId) {
      return NextResponse.json({ error: "Examination not found. Check your code and try again." }, { status: 404 });
    }

    const grant = await prisma.examAccessGrant.findUnique({
      where: { examId_traineeId: { examId: exam.id, traineeId: session.userId } },
      select: { revokedAt: true },
    });
    if (!grant || grant.revokedAt) {
      return NextResponse.json({ error: "Examination not found. Check your code and try again." }, { status: 404 });
    }

    const { attempt, orderedQuestions } = await startAttempt(exam, session.userId);

    return NextResponse.json({
      attemptId: attempt.id,
      examTitle: exam.title,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      secondsRemaining: secondsRemaining(attempt),
      allowReview: exam.allowReview,
      questions: orderedQuestions.map((q) => serveableQuestion(q, exam.randomizeOptions)),
    });
  });
}
