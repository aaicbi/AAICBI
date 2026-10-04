"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

interface SubmissionListItem {
  id: string;
  attemptNumber: number;
  status: string;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  trainee: { id: string; name: string; email: string };
  instructorReviewedBy: { name: string } | null;
  _count: { answers: number };
}

const NEEDS_REVIEW_STATUSES = new Set(["SUBMITTED", "ASSESSMENT_PENDING", "AI_ASSESSED", "MANUAL_PENDING"]);

export default function AssignmentSubmissionsPage({ params }: { params: { id: string } }) {
  const [submissions, setSubmissions] = useState<SubmissionListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    fetch(`/api/admin/assignments/${params.id}/submissions`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSubmissions)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const needsReview = submissions?.filter((s) => NEEDS_REVIEW_STATUSES.has(s.status)) ?? [];
  const decided = submissions?.filter((s) => !NEEDS_REVIEW_STATUSES.has(s.status)) ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Submissions</h1>

      <h2 className="mt-6 text-sm font-semibold text-gray-500">Needs Review ({needsReview.length})</h2>
      <div className="mt-2 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load submissions." onRetry={load} />
        ) : submissions === null ? (
          <SkeletonList />
        ) : needsReview.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing waiting on review.</p>
        ) : (
          needsReview.map((s) => <SubmissionRow key={s.id} assignmentId={params.id} submission={s} />)
        )}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-gray-500">Decided</h2>
          <div className="mt-2 space-y-3">
            {decided.map((s) => <SubmissionRow key={s.id} assignmentId={params.id} submission={s} />)}
          </div>
        </>
      )}

      {submissions !== null && submissions.length === 0 && <EmptyState title="No submissions yet" description="Once trainees submit, they'll show up here." />}
    </main>
  );
}

function SubmissionRow({ assignmentId, submission }: { assignmentId: string; submission: SubmissionListItem }) {
  return (
    <Link href={`/admin/assignments/${assignmentId}/submissions/${submission.id}`}>
      <Card className="transition hover:border-brand-teal">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display font-semibold text-brand-ink">{submission.trainee.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {submission.trainee.email} · Attempt {submission.attemptNumber} · {submission._count.answers} answer{submission._count.answers === 1 ? "" : "s"}
              {submission.submittedAt && ` · Submitted ${new Date(submission.submittedAt).toLocaleDateString()}`}
            </p>
            {submission.instructorReviewedBy && <p className="mt-0.5 text-xs text-gray-500">Reviewed by {submission.instructorReviewedBy.name}</p>}
          </div>
          <div className="shrink-0 text-right">
            {submission.percentage !== null && (
              <p className="font-display font-semibold text-brand-teal">{submission.totalScore}/{submission.maxScore} ({Math.round(submission.percentage)}%)</p>
            )}
            <Badge variant={submission.status === "AI_ASSESSED" ? "warning" : submission.status === "INSTRUCTOR_REVIEWED" ? "success" : "neutral"}>
              {submission.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
