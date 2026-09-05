"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface PerformanceSummaryDto {
  strengths: string[];
  weaknesses: string[];
  narrative: string;
}
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
  performanceSummary?: PerformanceSummaryDto;
}
interface ResultWithheld {
  released: false;
  message: string;
}

/** M13 — the strengths/weaknesses/narrative panel, shown only when a
 * summary actually exists (see the schema comment on
 * PerformanceSummary for why one might not — generation is
 * best-effort, not guaranteed). Absence is normal and unremarkable, so
 * this renders nothing rather than an empty state or an error when
 * there isn't one — the score above it is already the real result.
 *
 * Design-pass note: "Focus on" deliberately doesn't use gold or rose —
 * gold is reserved for course-level certificates (see Card.tsx), and
 * rose reads as an error, which constructive feedback isn't. Uses the
 * quieter Deep Harbor tone instead, which this brand's palette already
 * sets aside for secondary/muted UI. */
function PerformanceSummaryPanel({ summary }: { summary: PerformanceSummaryDto }) {
  return (
    <Card className="mt-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">How You Did By Topic</p>
      <p className="mt-2 text-sm text-gray-700">{summary.narrative}</p>
      {(summary.strengths.length > 0 || summary.weaknesses.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {summary.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-teal">Strong in</p>
              <ul className="mt-1 space-y-0.5">
                {summary.strengths.map((s) => (
                  <li key={s} className="text-sm text-brand-ink">
                    ✓ {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500">Focus on</p>
              <ul className="mt-1 space-y-0.5">
                {summary.weaknesses.map((w) => (
                  <li key={w} className="text-sm text-brand-ink">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** New: per-question review, only rendered when both the API sent it
 * AND the exam was configured with showCorrectAnswers — see this
 * route's own comment on why sending this unconditionally would be
 * wrong (it's opt-in per exam, not a default). Correct option always
 * gets a green check, whatever the trainee actually picked gets
 * highlighted too — in rose if it was wrong, so a trainee can see both
 * "what I chose" and "what was actually right" in the same glance
 * without needing a legend to explain it. */
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

export default function ModuleAssessmentResultPage({ params }: { params: { id: string; moduleId: string } }) {
  const [result, setResult] = useState<ResultReleased | ResultWithheld | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`lms_result_${params.moduleId}`);
    if (raw) setResult(JSON.parse(raw));
  }, [params.moduleId]);

  const nav = [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "Settings", href: "/trainee/settings" },
  ];

  if (!result) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col justify-center px-6 py-10">
          <div className="mx-auto h-4 w-32 animate-pulse rounded-full bg-brand-gray/60" />
          <div className="mx-auto mt-4 h-40 w-full animate-pulse rounded-xl bg-brand-gray/40" />
        </main>
      </>
    );
  }

  if (!result.released) {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-700">{result.message}</p>
          <a href={`/trainee/courses/${params.id}`} className="mt-6 text-sm font-semibold text-brand-teal hover:underline">
            ← Back to course
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex flex-col items-center">
          <span className="text-center text-xs font-semibold uppercase tracking-widest text-brand-teal">
            Assessment Result
          </span>

          <Card
            variant={result.passed ? "highlighted" : "default"}
            className={`mt-4 w-full max-w-md text-center ${result.passed ? "" : "border-brand-rose bg-brand-roseLight/40"}`}
          >
            <Badge variant={result.passed ? "success" : "danger"}>{result.passed ? "Passed" : "Not yet — try again"}</Badge>
            <p className="mt-3 font-display text-4xl font-semibold text-brand-ink">
              {result.score}
              <span className="text-xl font-normal text-gray-400">/{result.totalQuestions}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {Math.round(result.percentage)}% — pass mark is {result.passMarkPercent}%
            </p>
          </Card>

          {result.performanceSummary && (
            <div className="w-full max-w-md">
              <PerformanceSummaryPanel summary={result.performanceSummary} />
            </div>
          )}

          <Button href={`/trainee/courses/${params.id}`} size="lg" className="mt-6">
            Back to Course
          </Button>
        </div>

        {result.showCorrectAnswers && result.review && result.review.length > 0 && (
          <ReviewSection review={result.review} />
        )}
      </main>
    </>
  );
}
