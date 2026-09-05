"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";

interface ReviewQuestion {
  questionText: string;
  explanation: string | null;
  selectedOptionKey: string | null;
  options: { key: string; text: string; isCorrect: boolean }[];
}
interface ResultReleased {
  released: true;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passMarkPercent: number;
  showCorrectAnswers?: boolean;
  review?: ReviewQuestion[];
}
interface ResultWithheld {
  released: false;
  message: string;
}

/** Same review pattern as the LMS assessment result page — see that
 * file's own comment on the design reasoning. Duplicated rather than
 * shared as a common component only because these two result pages
 * (legacy by-code exam vs. LMS module assessment) have historically
 * been kept independent throughout this project rather than sharing
 * UI, and this is a small enough block that extracting a shared
 * component isn't worth the added indirection for two call sites. */
function ReviewSection({ review }: { review: ReviewQuestion[] }) {
  return (
    <div className="mt-6 space-y-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review Your Answers</p>
      {review.map((q, i) => {
        const gotItRight = q.selectedOptionKey && q.options.find((o) => o.key === q.selectedOptionKey)?.isCorrect;
        return (
          <Card key={i} className={gotItRight ? undefined : "border-brand-rose/40"}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-brand-ink">
                {i + 1}. {q.questionText}
              </p>
              <Badge variant={gotItRight ? "success" : "danger"}>{gotItRight ? "Correct" : "Incorrect"}</Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              {q.options.map((o) => {
                const wasSelected = o.key === q.selectedOptionKey;
                return (
                  <div
                    key={o.key}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      o.isCorrect
                        ? "border-brand-teal bg-brand-mint text-brand-ink"
                        : wasSelected
                          ? "border-brand-rose bg-brand-roseLight/40 text-brand-ink"
                          : "border-brand-gray text-gray-600"
                    }`}
                  >
                    {o.isCorrect ? "✓ " : wasSelected ? "✕ " : ""}
                    {o.text}
                    {wasSelected && !o.isCorrect && <span className="ml-1 text-xs text-brand-rose">(your answer)</span>}
                  </div>
                );
              })}
            </div>
            {q.explanation && (
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <span className="font-semibold text-brand-ink">Why: </span>
                {q.explanation}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function ResultPage({ params }: { params: { code: string } }) {
  const [result, setResult] = useState<ResultReleased | ResultWithheld | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`cbt_result_${params.code}`);
    if (raw) setResult(JSON.parse(raw));
  }, [params.code]);

  if (!result) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-6 py-10">
          <div className="h-40 animate-pulse rounded-xl bg-brand-gray/40" />
        </main>
      </>
    );
  }

  if (!result.released) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-700">{result.message}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex flex-col items-center">
          <span className="text-center text-xs font-semibold uppercase tracking-widest text-brand-teal">
            Examination Result
          </span>

          <Card variant={result.passed ? "celebratory" : "default"} className="mt-4 w-full max-w-md text-center">
            {result.passed && <AchievementDoodle className="mx-auto h-16 w-16" />}
            <div className="mt-2 flex justify-center">
              <Badge variant={result.passed ? "success" : "danger"}>
                {result.passed ? "PASSED" : "NOT YET — TRY AGAIN"}
              </Badge>
            </div>
            <p className="mt-3 font-display text-4xl font-semibold text-brand-ink">
              {result.score}
              <span className="text-xl text-gray-400">/{result.totalQuestions}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {Math.round(result.percentage)}% — pass mark is {result.passMarkPercent}%
            </p>
          </Card>

          <Button href="/" size="lg" className="mt-6">
            Return to Dashboard
          </Button>
        </div>

        {result.showCorrectAnswers && result.review && result.review.length > 0 && (
          <ReviewSection review={result.review} />
        )}
      </main>
    </>
  );
}
