"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";

interface QuestionStat {
  averagePercentage: number | null;
  answeredCorrectlyShare: number;
  needsImprovementShare: number;
  gradedCount: number;
}

interface AnalyticsDto {
  overall: {
    assignedCount: number;
    startedCount: number;
    submittedCount: number;
    pendingReviewCount: number;
    averagePercentage: number | null;
    highestPercentage: number | null;
    lowestPercentage: number | null;
    resubmissionRate: number;
  };
  questions: { id: string; questionNumber: string; questionText: string; maxMarks: number; stats: QuestionStat }[];
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n)}%`;
}

export default function AssignmentAnalyticsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<AnalyticsDto | null>(null);

  useEffect(() => {
    fetch(`/api/admin/assignments/${params.id}/analytics`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, [params.id]);

  if (!data) return <main className="mx-auto max-w-3xl px-6 py-10"><SkeletonList /></main>;

  const { overall, questions } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Assignment Analytics</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Assigned" value={String(overall.assignedCount)} />
        <StatTile label="Started" value={String(overall.startedCount)} />
        <StatTile label="Submitted" value={String(overall.submittedCount)} />
        <StatTile label="Pending Review" value={String(overall.pendingReviewCount)} />
        <StatTile label="Average Score" value={pct(overall.averagePercentage)} />
        <StatTile label="Highest Score" value={pct(overall.highestPercentage)} />
        <StatTile label="Lowest Score" value={pct(overall.lowestPercentage)} />
        <StatTile label="Resubmission Rate" value={`${Math.round(overall.resubmissionRate * 100)}%`} />
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-brand-ink">Per-Question Performance</h2>
      <div className="mt-3 space-y-3">
        {questions.map((q) => (
          <Card key={q.id}>
            <p className="font-semibold text-gray-900">Question {q.questionNumber}</p>
            <p className="mt-0.5 text-sm text-gray-600">{q.questionText}</p>
            {q.stats.gradedCount === 0 ? (
              <p className="mt-2 text-xs text-gray-400">Not yet assessed.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                <span>Average score: <strong>{pct(q.stats.averagePercentage)}</strong></span>
                <span>Answered well: <strong>{Math.round(q.stats.answeredCorrectlyShare * 100)}%</strong></span>
                <span>Needs improvement: <strong>{Math.round(q.stats.needsImprovementShare * 100)}%</strong></span>
                <span>({q.stats.gradedCount} graded)</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-gray bg-gray-50 p-3 text-center">
      <p className="font-display text-xl font-semibold text-brand-ink">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
}
