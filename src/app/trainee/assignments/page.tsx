"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

interface AssignmentListItem {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  course: { id: string; title: string } | null;
  latestSubmission: { status: string; percentage: number | null; totalScore: number | null; maxScore: number | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  ASSESSMENT_PENDING: "Being Assessed",
  AI_ASSESSED: "Assessed",
  MANUAL_PENDING: "Being Reviewed by Instructor",
  INSTRUCTOR_REVIEWED: "Reviewed",
  RETURNED: "Returned",
  RESUBMISSION_REQUIRED: "Resubmission Needed",
  COMPLETED: "Completed",
};

export default function TraineeAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    fetch("/api/trainee/assignments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAssignments)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Assignments</h1>
        <p className="mt-1 text-sm text-gray-500">Read each question, write your answer, save as you go, and submit when ready.</p>

        <div className="mt-6 space-y-3">
          {loadError ? (
            <ErrorState message="We couldn't load your assignments." onRetry={load} />
          ) : assignments === null ? (
            <SkeletonList />
          ) : assignments.length === 0 ? (
            <EmptyState title="No assignments yet" description="Your instructor hasn't published any assignments for your courses yet." />
          ) : (
            assignments.map((a) => {
              const status = a.latestSubmission?.status ?? "NOT_STARTED";
              const isDone = ["AI_ASSESSED", "INSTRUCTOR_REVIEWED", "COMPLETED"].includes(status);
              return (
                <Link key={a.id} href={isDone ? `/trainee/assignments/${a.id}/result` : `/trainee/assignments/${a.id}`}>
                  <Card className="transition hover:border-brand-teal">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-brand-ink">{a.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {a.course?.title ?? "General"}
                          {a.dueAt && ` · Due ${new Date(a.dueAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {isDone && a.latestSubmission?.percentage !== null && a.latestSubmission?.percentage !== undefined && (
                          <p className="font-display font-semibold text-brand-teal">{Math.round(a.latestSubmission.percentage)}%</p>
                        )}
                        <Badge variant={isDone ? "success" : status === "NOT_STARTED" ? "neutral" : "warning"}>
                          {STATUS_LABEL[status] ?? "Not Started"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
