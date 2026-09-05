"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface CohortRow {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  _count: { enrollments: number };
}

/**
 * Whole-project audit recommendation: intake/cohort tracking. This is
 * purely a roster/reporting layer on top of the existing open-access
 * course model — see the schema comment on Cohort for the full design
 * reasoning, especially what it deliberately doesn't solve (per-cohort
 * progress reset).
 */
export default function CourseCohortsPage({ params }: { params: { id: string } }) {
  const [cohorts, setCohorts] = useState<CohortRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCohorts() {
    fetch(`/api/courses/${params.id}/cohorts`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        setCohorts(await r.json());
      })
      .catch(() => setNotFound(true));
  }

  useEffect(() => {
    loadCohorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function createCohort(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/courses/${params.id}/cohorts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create cohort.");
      return;
    }
    setName("");
    setStartDate("");
    setEndDate("");
    setShowForm(false);
    loadCohorts();
  }

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Course not found, or you don&apos;t have access to it.
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <a href={`/admin/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          ← Back to course
        </a>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Cohorts / Intakes</h1>
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Cohort"}
          </Button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Optional rosters for reporting on a specific intake separately — every trainee can still access this
          course whether or not they&apos;re enrolled in a cohort of it.
        </p>

        {showForm && (
          <form onSubmit={createCohort} className="mt-4 space-y-3 rounded-xl border border-brand-gray bg-white dark:bg-brand-surface p-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cohort name, e.g. January 2026 Intake"
              aria-label="Cohort name"
              required
              className="w-full rounded-lg border border-brand-gray p-2 text-sm outline-none focus:border-brand-teal"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-gray-600">
                Start date (optional)
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand-gray p-2 text-sm outline-none focus:border-brand-teal"
                />
              </label>
              <label className="block text-xs text-gray-600">
                End date (optional)
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand-gray p-2 text-sm outline-none focus:border-brand-teal"
                />
              </label>
            </div>
            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={creating}>
              {creating ? "Creating..." : "Create Cohort"}
            </Button>
          </form>
        )}

        <div className="mt-6 space-y-3">
          {cohorts === null ? (
            <SkeletonList rows={3} />
          ) : cohorts.length === 0 ? (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No cohorts yet"
              description="Trainees can still take this course without one — create a cohort when you want to track a specific intake's roster and progress separately."
            />
          ) : (
            cohorts.map((c) => (
              <a key={c.id} href={`/admin/cohorts/${c.id}`}>
                <Card interactive className="flex items-center justify-between hover:border-brand-teal">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{c.name}</p>
                    {(c.startDate || c.endDate) && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}
                        {" – "}
                        {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {c._count.enrollments} trainee{c._count.enrollments === 1 ? "" : "s"} →
                  </span>
                </Card>
              </a>
            ))
          )}
        </div>
      </main>
    </>
  );
}
