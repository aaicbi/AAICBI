"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

interface ReportDto {
  id: string;
  reporterType: string;
  reportedType: "TRAINEE" | "EMPLOYER";
  reportedId: string;
  reportedName: string;
  reason: string;
  details: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED" | "ACTION_TAKEN";
  reviewedByName: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<ReportDto["status"], "warning" | "neutral" | "danger"> = {
  PENDING: "warning",
  REVIEWED: "neutral",
  DISMISSED: "neutral",
  ACTION_TAKEN: "danger",
};

/**
 * Universal profile system, Phase 3 — admin review queue for reported
 * profiles, mirroring /admin/employers' pending/decided layout.
 */
export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportDto[] | null>(null);
  const [error, setError] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setError(false);
    fetch("/api/admin/reports")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setReports)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "REVIEWED" | "DISMISSED" | "ACTION_TAKEN") {
    setDeciding(id);
    const res = await fetch(`/api/admin/reports/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setDeciding(null);
    if (!res.ok) {
      showToast("Could not update report.", "error");
      return;
    }
    showToast("Updated.");
    load();
  }

  const pending = reports?.filter((r) => r.status === "PENDING") ?? [];
  const decided = reports?.filter((r) => r.status !== "PENDING") ?? [];

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Reported Profiles</h1>

        {error ? (
          <ErrorState message="We couldn't load reports." onRetry={load} />
        ) : reports === null ? (
          <div className="mt-4">
            <SkeletonList />
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Pending Review</p>
            <div className="mt-2 space-y-3">
              {pending.length === 0 ? (
                <EmptyState title="Nothing pending" description="No profile reports are waiting for review." />
              ) : (
                pending.map((r) => (
                  <Card key={r.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-display font-semibold text-brand-ink">
                          {r.reportedName} <span className="text-xs font-normal text-gray-400">({r.reportedType.toLowerCase()})</span>
                        </p>
                        <p className="mt-1 text-sm text-gray-700">{r.reason}</p>
                        {r.details && <p className="mt-1 text-xs text-gray-500">{r.details}</p>}
                        <p className="mt-1 text-xs text-gray-400">Reported by a {r.reporterType.toLowerCase()} account</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => decide(r.id, "DISMISSED")} loading={deciding === r.id}>
                        Dismiss
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => decide(r.id, "ACTION_TAKEN")} loading={deciding === r.id}>
                        Action Taken
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {decided.length > 0 && (
              <>
                <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">Previously Reviewed</p>
                <div className="mt-2 space-y-2">
                  {decided.map((r) => (
                    <Card key={r.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-brand-ink">
                            {r.reportedName} <span className="text-xs font-normal text-gray-400">({r.reportedType.toLowerCase()})</span>
                          </p>
                          <p className="text-xs text-gray-500">{r.reason}</p>
                          {r.reviewedByName && <p className="text-xs text-gray-400">Reviewed by {r.reviewedByName}</p>}
                        </div>
                        <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
