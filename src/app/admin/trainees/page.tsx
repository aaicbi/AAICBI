"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { ADMIN_NAV } from "@/lib/admin/nav";

import { Input } from "@/components/ui/Field";
const FIXED_SEGMENT_LABEL: Record<string, string> = {
  REGISTERED_NOT_ENROLLED: "Registered, not yet enrolled",
  STARTED_NOT_COMPLETED: "Started a course, not completed",
  COMPLETED_AT_LEAST_ONE: "Completed at least one course",
  HIGHLY_ENGAGED: "Highly engaged",
  INACTIVE: "Inactive",
};

function segmentLabel(key: string): string {
  if (key.startsWith("INTERESTED_IN:")) return `Interested in ${key.slice("INTERESTED_IN:".length)}`;
  return FIXED_SEGMENT_LABEL[key] ?? key;
}

interface TraineeRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  createdAt: string;
  emailVerified: boolean;
  publiclyDiscoverable: boolean;
  suspended: boolean;
  certificateCount: number;
  courseCount: number;
}

/**
 * Universal profile system, Phase 3 — the trainee half of the admin
 * profile-management console. No such list/search page existed
 * anywhere in this app before this (only a per-trainee ai-credits
 * action route did) — modeled on /admin/staff's list layout.
 */
export default function AdminTraineesPage() {
  return (
    <Suspense fallback={null}>
      <AdminTraineesContent />
    </Suspense>
  );
}

function AdminTraineesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const segment = searchParams.get("segment");

  const [trainees, setTrainees] = useState<TraineeRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  function load(query = q) {
    setError(false);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (segment) params.set("segment", segment);
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/admin/trainees${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTrainees)
      .catch(() => setError(true));
  }

  useEffect(() => {
    setTrainees(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setTrainees(null);
    load(q);
  }

  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Trainees</h1>
        <p className="mt-1 text-sm text-gray-500">Search and review trainee accounts and profiles.</p>

        {segment && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-teal bg-brand-mint/40 px-4 py-2.5">
            <p className="text-sm text-brand-tealDeep">
              Showing segment: <strong>{segmentLabel(segment)}</strong>
            </p>
            <button
              onClick={() => router.push("/admin/trainees")}
              className="text-xs font-semibold text-brand-teal hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        <form onSubmit={search} className="mt-4 flex gap-2">
          <Input label="Search by name, email, or username" hideLabel compact value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, or username" />
        </form>

        <div className="mt-4 space-y-2">
          {error ? (
            <ErrorState message="We couldn't load trainees." onRetry={() => load()} />
          ) : trainees === null ? (
            <SkeletonList />
          ) : trainees.length === 0 ? (
            <EmptyState title="No trainees found" description="Try a different search." />
          ) : (
            trainees.map((t) => (
              <a key={t.id} href={`/admin/trainees/${t.id}`}>
                <Card interactive>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display font-semibold text-brand-ink">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.email}
                        {t.username && ` · @${t.username}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {!t.emailVerified && <Badge variant="warning">Unverified</Badge>}
                      {t.publiclyDiscoverable && <Badge variant="success">Discoverable</Badge>}
                      {t.suspended && <Badge variant="danger">Suspended</Badge>}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {t.certificateCount} certificate{t.certificateCount === 1 ? "" : "s"} · {t.courseCount} course
                    {t.courseCount === 1 ? "" : "s"}
                  </p>
                </Card>
              </a>
            ))
          )}
        </div>
      </main>
    </>
  );
}
