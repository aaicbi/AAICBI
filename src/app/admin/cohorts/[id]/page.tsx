"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DataTable from "@/components/ui/DataTable";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { useToast } from "@/components/ui/Toast";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import BackLink from "@/components/ui/BackLink";
import Icon from "@/components/ui/Icon";
import { AchievementIcon } from "@/components/icons/brand";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Input } from "@/components/ui/Field";
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
        <SiteHeader
          nav={ADMIN_NAV}
          right={<LogoutButton />}
        />
        <main className="mx-auto max-w-2xl px-6 py-10 text-center text-gray-600">
          Cohort not found, or you don&apos;t have access to it.
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        nav={ADMIN_NAV}
        right={<LogoutButton />}
      />
      {modal}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink
          href={cohort ? `/admin/courses/${cohort.course.id}/cohorts` : "#"}
          className="text-sm text-brand-teal hover:underline"
        >
          Back to cohorts
        </BackLink>
        {!cohort ? (
          <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-brand-gray/60" />
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{cohort.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{cohort.course.title}</p>
          </>
        )}

        <form onSubmit={enrollTrainee} className="mt-6 flex gap-2">
          <Input label="Trainee email" hideLabel compact wrapperClassName="flex-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainee@example.com" required />
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
          <div className="mt-6">
            <DataTable
              caption="Trainees in this cohort"
              rows={cohort ? cohort.roster : null}
              rowKey={(r) => r.trainee.id}
              searchLabel="Search trainees"
              searchText={(r) => `${r.trainee.name} ${r.trainee.email}`}
              columns={[
                {
                  key: "trainee",
                  header: "Trainee",
                  sortValue: (r) => r.trainee.name,
                  render: (r) => (
                    <div>
                      <div className="font-medium text-brand-ink">{r.trainee.name}</div>
                      <div className="text-xs font-normal text-gray-600">{r.trainee.email}</div>
                    </div>
                  ),
                },
                {
                  key: "progress",
                  header: "Progress",
                  sortValue: (r) => (r.totalModules === 0 ? 0 : r.completedModules / r.totalModules),
                  render: (r) => {
                    const pct = r.totalModules === 0 ? 0 : Math.round((r.completedModules / r.totalModules) * 100);
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-20 overflow-hidden rounded-full bg-brand-gray/50"
                          role="progressbar"
                          aria-label={`${r.trainee.name} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={pct}
                        >
                          <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">
                          {r.completedModules}/{r.totalModules}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  key: "certificate",
                  header: "Certificate",
                  sortValue: (r) => (r.hasCertificate ? 1 : 0),
                  render: (r) =>
                    r.hasCertificate && r.certificateCode ? (
                      <a
                        href={`/certificate/${r.certificateCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-goldText hover:underline"
                      >
                        <Icon icon={AchievementIcon} size="sm" className="mr-1 inline align-text-bottom" /> View
                      </a>
                    ) : (
                      <span className="text-xs text-gray-600">Not yet</span>
                    ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r) => (
                    <button
                      onClick={() => removeTrainee(r.trainee.id, r.trainee.name)}
                      className="text-xs font-semibold text-brand-rose hover:underline"
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
            />
          </div>
        )}
      </main>
    </>
  );
}
