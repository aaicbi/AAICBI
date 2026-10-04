"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Sparkles } from "lucide-react";

interface CriterionScore {
  name: string;
  score: number;
  maximum: number;
  reason: string;
}

interface AnswerDto {
  id: string;
  answerText: string | null;
  aiScore: number | null;
  aiMaxScore: number | null;
  aiCriteriaScores: CriterionScore[] | null;
  aiStrengths: string[] | null;
  aiAreasForImprovement: string[] | null;
  aiFeedback: string | null;
  aiConfidence: number | null;
  aiNeedsInstructorReview: boolean;
  instructorScore: number | null;
  instructorFeedback: string | null;
  question: {
    id: string;
    questionNumber: string;
    questionText: string;
    instructions: string | null;
    expectedAnswer: string | null;
    expectedConcepts: string[] | null;
    rubric: { name: string; maxMarks: number; description: string | null }[] | null;
    maxMarks: number;
  };
}

interface SubmissionDto {
  id: string;
  attemptNumber: number;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  instructorComments: string | null;
  trainee: { name: string; email: string };
  answers: AnswerDto[];
}

export default function SubmissionReviewPage({ params }: { params: { id: string; submissionId: string } }) {
  const [submission, setSubmission] = useState<SubmissionDto | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { score: string; feedback: string }>>({});
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    const res = await fetch(`/api/admin/assignments/${params.id}/submissions/${params.submissionId}`);
    if (!res.ok) return;
    const data: SubmissionDto = await res.json();
    setSubmission(data);
    setComments(data.instructorComments ?? "");
    const initial: Record<string, { score: string; feedback: string }> = {};
    for (const a of data.answers) {
      initial[a.id] = {
        score: (a.instructorScore ?? a.aiScore ?? "").toString(),
        feedback: a.instructorFeedback ?? "",
      };
    }
    setOverrides(initial);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.submissionId]);

  async function submitDecision(decision: "ACCEPTED_AI_SCORE" | "SCORE_ADJUSTED" | "RETURNED" | "RESUBMISSION_REQUIRED") {
    if (!submission) return;
    setSaving(true);
    const answerOverrides = submission.answers.map((a) => ({
      answerId: a.id,
      instructorScore: overrides[a.id]?.score.trim() ? Number(overrides[a.id].score) : null,
      instructorFeedback: overrides[a.id]?.feedback.trim() || null,
    }));
    const res = await fetch(`/api/admin/assignments/${params.id}/submissions/${params.submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerOverrides, instructorComments: comments || null, decision }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not save your review.", "error");
      return;
    }
    showToast("Review saved.");
    load();
  }

  if (!submission) return <main className="mx-auto max-w-3xl px-6 py-10"><SkeletonList /></main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{submission.trainee.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{submission.trainee.email} · Attempt {submission.attemptNumber}</p>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant="neutral">{submission.status.replace(/_/g, " ")}</Badge>
          {submission.percentage !== null && <p className="mt-1 font-display text-lg font-semibold text-brand-teal">{submission.totalScore}/{submission.maxScore} ({Math.round(submission.percentage)}%)</p>}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {submission.answers.map((a) => (
          <Card key={a.id}>
            <p className="font-display font-semibold text-brand-ink">Question {a.question.questionNumber} <span className="font-normal text-gray-500">({a.question.maxMarks} marks)</span></p>
            <p className="mt-1 text-sm text-gray-700">{a.question.questionText}</p>

            <div className="mt-3 rounded-lg border border-brand-gray bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Student&apos;s Answer</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{a.answerText || <span className="text-gray-400">No answer provided.</span>}</p>
            </div>

            {(a.question.expectedAnswer || (a.question.expectedConcepts && a.question.expectedConcepts.length > 0)) && (
              <div className="mt-2 rounded-lg border border-brand-gray p-3">
                <p className="text-xs font-semibold text-gray-500">Expected Answer / Concepts</p>
                {a.question.expectedAnswer && <p className="mt-1 text-sm text-gray-700">{a.question.expectedAnswer}</p>}
                {a.question.expectedConcepts && <p className="mt-1 text-xs text-gray-500">Concepts: {a.question.expectedConcepts.join(", ")}</p>}
              </div>
            )}

            {a.aiScore !== null && (
              <div className="mt-2 rounded-lg border border-brand-teal/30 bg-brand-mint/40 p-3">
                <p className="text-xs font-semibold text-brand-teal">
                  <Icon icon={Sparkles} size="sm" className="mr-1 inline align-text-bottom" /> AI Assessment: {a.aiScore}/{a.aiMaxScore}
                  {a.aiConfidence !== null && ` · Confidence: ${Math.round(a.aiConfidence * 100)}%`}
                  {a.aiNeedsInstructorReview && " · Flagged for review"}
                </p>
                {a.aiCriteriaScores && a.aiCriteriaScores.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
                    {a.aiCriteriaScores.map((c, i) => <li key={i}>{c.name}: {c.score}/{c.maximum} — {c.reason}</li>)}
                  </ul>
                )}
                {a.aiFeedback && <p className="mt-1 text-sm text-gray-700">{a.aiFeedback}</p>}
                {a.aiStrengths && a.aiStrengths.length > 0 && <p className="mt-1 text-xs text-gray-600"><strong>Strengths:</strong> {a.aiStrengths.join("; ")}</p>}
                {a.aiAreasForImprovement && a.aiAreasForImprovement.length > 0 && <p className="mt-1 text-xs text-gray-600"><strong>Areas for improvement:</strong> {a.aiAreasForImprovement.join("; ")}</p>}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block text-xs text-gray-700">
                Final score (max {a.question.maxMarks})
                <input
                  type="number"
                  min={0}
                  max={a.question.maxMarks}
                  value={overrides[a.id]?.score ?? ""}
                  onChange={(e) => setOverrides({ ...overrides, [a.id]: { ...overrides[a.id], score: e.target.value } })}
                  className="mt-1 block w-24 rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                />
              </label>
              <label className="block min-w-[14rem] flex-1 text-xs text-gray-700">
                Instructor feedback (optional — overrides AI feedback for this question)
                <input
                  value={overrides[a.id]?.feedback ?? ""}
                  onChange={(e) => setOverrides({ ...overrides, [a.id]: { ...overrides[a.id], feedback: e.target.value } })}
                  className="mt-1 w-full rounded-lg border border-brand-gray px-2.5 py-1.5 text-sm outline-none focus:border-brand-teal"
                />
              </label>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <label className="block text-sm font-semibold text-gray-900">
          Overall comments to the trainee (optional)
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => submitDecision("ACCEPTED_AI_SCORE")} loading={saving} size="sm">Accept AI Score</Button>
          <Button onClick={() => submitDecision("SCORE_ADJUSTED")} loading={saving} variant="secondary" size="sm">Save Adjusted Scores</Button>
          <Button onClick={() => submitDecision("RETURNED")} loading={saving} variant="secondary" size="sm">Return to Trainee</Button>
          <Button onClick={() => submitDecision("RESUBMISSION_REQUIRED")} loading={saving} variant="danger" size="sm">Request Resubmission</Button>
        </div>
      </Card>
    </main>
  );
}
