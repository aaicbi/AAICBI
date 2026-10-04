"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";

interface AnswerResult {
  questionNumber: string;
  questionText: string;
  maxMarks: number;
  answerText: string | null;
  score: number | null;
  scoreSource: "ai" | "instructor" | null;
  feedback: string | null;
  strengths: string[] | null;
  areasForImprovement: string[] | null;
}

interface ResultDto {
  assignmentTitle: string;
  status: string;
  attemptNumber: number;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  overallFeedback: string | null;
  overallStrengths: string[] | null;
  overallAreasForImprovement: string[] | null;
  instructorComments: string | null;
  answers: AnswerResult[];
}

const PENDING_STATUSES = new Set(["SUBMITTED", "ASSESSMENT_PENDING", "MANUAL_PENDING"]);

export default function AssignmentResultPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<ResultDto | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/trainee/assignments/${params.id}/result`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => setNotFound(true));
  }, [params.id]);

  if (notFound) return <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">No result found yet.</main>;
  if (!result) return <main className="mx-auto max-w-2xl px-6 py-10"><SkeletonList /></main>;

  const isPending = PENDING_STATUSES.has(result.status);

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">{result.assignmentTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">Attempt {result.attemptNumber}</p>

        {isPending ? (
          <Card className="mt-6 text-center">
            <p className="font-display text-lg font-semibold text-brand-ink">
              {result.status === "MANUAL_PENDING" ? "Being reviewed by your instructor" : "Being assessed"}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {result.status === "MANUAL_PENDING"
                ? "Your instructor grades this assignment manually. You'll be notified once feedback is ready."
                : "This usually takes just a moment. Refresh this page shortly."}
            </p>
          </Card>
        ) : (
          <>
            <Card className="mt-6 text-center">
              <p className="font-display text-3xl font-semibold text-brand-teal">
                {result.totalScore}/{result.maxScore}
              </p>
              <p className="text-sm text-gray-500">{result.percentage !== null ? `${Math.round(result.percentage)}%` : ""}</p>
              {result.overallFeedback && <p className="mt-3 text-sm text-gray-700">{result.overallFeedback}</p>}
              {result.instructorComments && (
                <p className="mt-2 rounded-lg bg-brand-mint/40 p-3 text-sm text-brand-ink"><strong>Instructor comments:</strong> {result.instructorComments}</p>
              )}
              {result.overallStrengths && result.overallStrengths.length > 0 && (
                <p className="mt-2 text-xs text-gray-600"><strong>Strengths:</strong> {result.overallStrengths.join("; ")}</p>
              )}
              {result.overallAreasForImprovement && result.overallAreasForImprovement.length > 0 && (
                <p className="mt-1 text-xs text-gray-600"><strong>Focus on:</strong> {result.overallAreasForImprovement.join("; ")}</p>
              )}
            </Card>

            <div className="mt-6 space-y-4">
              {result.answers.map((a) => (
                <Card key={a.questionNumber}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display font-semibold text-brand-ink">Question {a.questionNumber}</p>
                    {a.score !== null && <Badge variant="success">{a.score}/{a.maxMarks}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{a.questionText}</p>
                  <div className="mt-2 rounded-lg border border-brand-gray bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">{a.answerText || "No answer provided."}</div>
                  {a.feedback && <p className="mt-2 text-sm text-gray-700"><strong>Feedback:</strong> {a.feedback}</p>}
                  {a.strengths && a.strengths.length > 0 && <p className="mt-1 text-xs text-gray-600"><strong>What you did well:</strong> {a.strengths.join("; ")}</p>}
                  {a.areasForImprovement && a.areasForImprovement.length > 0 && <p className="mt-1 text-xs text-gray-600"><strong>What to improve:</strong> {a.areasForImprovement.join("; ")}</p>}
                </Card>
              ))}
            </div>
          </>
        )}

        <Button href="/trainee/assignments" variant="secondary" className="mt-6">Back to Assignments</Button>
      </main>
    </>
  );
}
