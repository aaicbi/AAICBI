"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

interface AssignmentListItem {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  dueAt: string | null;
  course: { id: string; title: string } | null;
  module: { id: string; title: string } | null;
  _count: { questions: number; submissions: number };
}

const STATUS_VARIANT: Record<AssignmentListItem["status"], "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
  ARCHIVED: "neutral",
};

/**
 * AI Assignment Engine — the admin list page. No per-page SiteHeader
 * call — new pages built after the admin sidebar rollout don't need
 * one; the sidebar provides navigation (same convention as
 * /admin/training-organizations and every other post-rollout page).
 */
export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    fetch("/api/admin/assignments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAssignments)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Assignments</h1>
        <div className="flex gap-2">
          <Button href="/admin/assignments/new?mode=upload" size="sm">
            Upload Word Document
          </Button>
          <Button href="/admin/assignments/new" variant="secondary" size="sm">
            Create Manually
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Upload a Word document of questions and let AI structure it into a gradable assignment, or build one by hand.
      </p>

      <div className="mt-6 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load assignments." onRetry={load} />
        ) : assignments === null ? (
          <SkeletonList />
        ) : assignments.length === 0 ? (
          <EmptyState title="No assignments yet" description="Upload a Word document or create one manually to get started." />
        ) : (
          assignments.map((a) => (
            <Link key={a.id} href={`/admin/assignments/${a.id}`}>
              <Card className="transition hover:border-brand-teal">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-brand-ink">{a.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {a.course?.title ?? a.module?.title ?? "Not attached to a course yet"} · {a._count.questions} question
                      {a._count.questions === 1 ? "" : "s"} · {a._count.submissions} submission{a._count.submissions === 1 ? "" : "s"}
                      {a.dueAt && ` · Due ${new Date(a.dueAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
