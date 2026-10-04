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

  // Grouped by trainee so a resubmission history (attempt 1, 2, 3...)
  // reads as one visual block instead of scattering across the list.
  const groups: { trainee: SubmissionListItem["trainee"]; attempts: SubmissionListItem[]; needsReview: boolean }[] = [];
  for (const s of submissions ?? []) {
    let group = groups.find((g) => g.trainee.id === s.trainee.id);
    if (!group) {
      group = { trainee: s.trainee, attempts: [], needsReview: false };
      groups.push(group);
    }
    group.attempts.push(s);
    if (NEEDS_REVIEW_STATUSES.has(s.status)) group.needsReview = true;
  }
  for (const g of groups) g.attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
  groups.sort((a, b) => Number(b.needsReview) - Number(a.needsReview));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Submissions</h1>

      <div className="mt-6 space-y-4">
        {loadError ? (
          <ErrorState message="We couldn't load submissions." onRetry={load} />
        ) : submissions === null ? (
          <SkeletonList />
        ) : groups.length === 0 ? (
          <EmptyState title="No submissions yet" description="Once trainees submit, they'll show up here." />
        ) : (
          groups.map((g) => <TraineeGroup key={g.trainee.id} assignmentId={params.id} group={g} />)
        )}
      </div>
    </main>
  );
}

function TraineeGroup({ assignmentId, group }: { assignmentId: string; group: { trainee: SubmissionListItem["trainee"]; attempts: SubmissionListItem[]; needsReview: boolean } }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-semibold text-brand-ink">{group.trainee.name}</p>
        {group.needsReview && <Badge variant="warning">Needs review</Badge>}
      </div>
      <p className="text-xs text-gray-500">{group.trainee.email}</p>
      <div className="mt-3 space-y-2">
        {group.attempts.map((s) => (
          <SubmissionRow key={s.id} assignmentId={assignmentId} submission={s} />
        ))}
      </div>
    </Card>
  );
}

function SubmissionRow({ assignmentId, submission }: { assignmentId: string; submission: SubmissionListItem }) {
  return (
    <Link href={`/admin/assignments/${assignmentId}/submissions/${submission.id}`}>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-brand-gray p-3 transition hover:border-brand-teal">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-ink">
            Attempt {submission.attemptNumber} · {submission._count.answers} answer{submission._count.answers === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {submission.submittedAt ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString()}` : "Not yet submitted"}
            {submission.instructorReviewedBy && ` · Reviewed by ${submission.instructorReviewedBy.name}`}
          </p>
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
    </Link>
  );
}
