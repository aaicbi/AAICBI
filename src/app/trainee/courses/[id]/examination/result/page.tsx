"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

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

/** Same deliberate review-section design as the module assessment
 * result page — see that file's own comment on the color reasoning
 * (correct always green, the trainee's own wrong pick in rose, no
 * legend needed). Course examinations don't carry a per-attempt
 * performance summary the way a module assessment does (that's an M13
 * feature scoped to module-level attempts), so this omits that panel
 * rather than fake one that was never generated. */
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

export default function CourseExaminationResultPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<ResultReleased | ResultWithheld | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`lms_course_exam_result_${params.id}`);
    if (raw) setResult(JSON.parse(raw));
  }, [params.id]);

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
            Course Examination Result
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
