"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface RosterEntry {
  trainee: { id: string; name: string; email: string };
  enrolledAt: string;
  completedModules: number;
  totalModules: number;
  hasCertificate: boolean;
  certificateCode: string | null;
}
interface CohortDetail {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  course: { id: string; title: string };
  roster: RosterEntry[];
}

export default function CohortDetailPage({ params }: { params: { id: string } }) {
  const [cohort, setCohort] = useState<CohortDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, modal } = useConfirmModal();
  const { showToast } = useToast();

  function loadCohort() {
    fetch(`/api/cohorts/${params.id}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        setCohort(await r.json());
      })
      .catch(() => setNotFound(true));
  }

  useEffect(() => {
    loadCohort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function enrollTrainee(e: React.FormEvent) {
    e.preventDefault();
    setEnrolling(true);
    setError(null);
    const res = await fetch(`/api/cohorts/${params.id}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setEnrolling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not enroll that trainee.");
      return;
    }
    setEmail("");
    showToast("Trainee enrolled.", "success");
    loadCohort();
  }

  async function removeTrainee(traineeId: string, traineeName: string) {
    const ok = await confirm({
      title: "Remove from roster?",
      description: `${traineeName}'s progress, attempts, and certificate for this course are not affected — this only removes them from the ${cohort?.name ?? "cohort"} roster.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/cohorts/${params.id}/enrollments/${traineeId}`, { method: "DELETE" });
    showToast("Removed from roster.", "success");
    loadCohort();
  }

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Cohort not found, or you don&apos;t have access to it.
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <a
          href={cohort ? `/admin/courses/${cohort.course.id}/cohorts` : "#"}
          className="text-sm text-brand-teal hover:underline"
        >
          ← Back to cohorts
        </a>
        {!cohort ? (
          <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-brand-gray/60" />
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{cohort.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{cohort.course.title}</p>
          </>
        )}

        <form onSubmit={enrollTrainee} className="mt-6 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trainee@example.com"
            aria-label="Trainee email"
            required
            className="flex-1 rounded-lg border border-brand-gray px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
          />
          <Button type="submit" loading={enrolling}>
            Enroll
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-brand-rose">{error}</p>}

        {cohort && cohort.roster.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No trainees enrolled yet"
              description="Add one above by email to start this cohort's roster."
            />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-gray text-gray-500">
                <th className="py-2">Trainee</th>
                <th>Progress</th>
                <th>Certificate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!cohort ? (
                <SkeletonTableRows rows={4} cols={4} />
              ) : (
                cohort.roster.map((r) => {
                  const pct = r.totalModules === 0 ? 0 : Math.round((r.completedModules / r.totalModules) * 100);
                  return (
                    <tr key={r.trainee.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <div className="font-medium text-brand-ink">{r.trainee.name}</div>
                        <div className="text-xs text-gray-500">{r.trainee.email}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-brand-gray/50">
                            <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">
                            {r.completedModules}/{r.totalModules}
                          </span>
                        </div>
                      </td>
                      <td>
                        {r.hasCertificate && r.certificateCode ? (
                          <a
                            href={`/certificate/${r.certificateCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-brand-gold hover:underline"
                          >
                            🎓 View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not yet</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => removeTrainee(r.trainee.id, r.trainee.name)}
                          className="text-xs font-semibold text-brand-rose hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
