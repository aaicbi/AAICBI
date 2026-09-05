import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { submitAttempt } from "@/lib/examEngine";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const attempt = await submitAttempt(params.id);
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId } });

    if (!exam.showResultImmediately) {
      return NextResponse.json({
        released: false,
        message:
          "Your examination has been successfully submitted. Your result will be available once it has been released by the administrator.",
      });
    }

    // M13 — same "released" gate as everything else in this response:
    // if results are withheld, the performance summary is too (it's
    // conceptually part of "the result," not a separate thing). Not
    // every attempt has one — see the schema comment on
    // PerformanceSummary for why generation can silently not happen —
    // so this is just omitted (undefined) rather than an empty
    // placeholder when there isn't one.
    const performanceSummary = await prisma.performanceSummary.findUnique({
      where: { attemptId: attempt.id },
      select: { strengths: true, weaknesses: true, narrative: true },
    });

    // Audit finding: `showCorrectAnswers` was already threaded all the
    // way to the client as a boolean, but nothing ever sent the actual
    // per-question data it's supposed to gate — submitAttempt() computes
    // and stores Answer.isCorrect and Question.explanation exists in the
    // schema, but neither ever left the server. The flag was reaching
    // the client with nothing for it to turn on. §40's "never send
    // isCorrect/explanation for an IN_PROGRESS attempt" rule (see
    // examEngine.ts's file header) is specifically about attempts still
    // in progress — this attempt is already SUBMITTED by the time we're
    // here, so revealing this is the intended behavior when staff opted
    // into it for this exam, not a violation of that rule.
    let review: unknown[] | undefined;
    if (exam.showCorrectAnswers) {
      const questionIds = (attempt.questionOrder as string[]) ?? [];
      const [questions, answers] = await Promise.all([
        prisma.question.findMany({
          where: { id: { in: questionIds } },
          include: { options: { orderBy: { order: "asc" } } },
        }),
        prisma.answer.findMany({ where: { attemptId: attempt.id } }),
      ]);
      type QuestionWithOptions = {
        id: string;
        text: string;
        explanation: string | null;
        options: { key: string; text: string; isCorrect: boolean }[];
      };
      // Explicit tuple return type on each map callback below is load-
      // bearing, not decoration: `arr.map(x => [a, b])` infers a union
      // array type by default (`(TypeOfA | TypeOfB)[]`), not a tuple —
      // a real, easy-to-hit TypeScript gotcha, not a Prisma-generation
      // artifact. Without it, `new Map(...)` can't resolve a proper
      // value type and every `.get()` below comes back typed as `{}`.
      const questionById = new Map<string, QuestionWithOptions>(
        questions.map((q: QuestionWithOptions): [string, QuestionWithOptions] => [q.id, q])
      );
      const answerByQuestionId = new Map<string, { selectedOptionKey: string | null }>(
        answers.map((a: { questionId: string; selectedOptionKey: string | null }): [string, { selectedOptionKey: string | null }] => [
          a.questionId,
          a,
        ])
      );

      review = questionIds
        .map((qId: string) => {
          const question = questionById.get(qId);
          if (!question) return null; // question was deleted after this attempt was taken — skip rather than error
          const answer = answerByQuestionId.get(qId);
          return {
            questionText: question.text,
            explanation: question.explanation,
            selectedOptionKey: answer?.selectedOptionKey ?? null,
            options: question.options.map((o) => ({
              key: o.key,
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          };
        })
        .filter((q: unknown): q is NonNullable<typeof q> => q !== null);
    }

    return NextResponse.json({
      released: true,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      percentage: attempt.percentage,
      passed: attempt.passed,
      // M11 audit finding: report the pass mark that was actually used
      // to grade this attempt (snapshotted at start — see
      // examEngine.ts's submitAttempt), not the exam's current value,
      // which could have changed since. Showing "you needed 80%" when
      // the exam's live setting is now 90% would be confusing at best.
      passMarkPercent: attempt.passMarkPercent ?? exam.passMarkPercent,
      showCorrectAnswers: exam.showCorrectAnswers,
      review,
      performanceSummary: performanceSummary ?? undefined,
    });
  });
}
