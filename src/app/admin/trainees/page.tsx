"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

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
  const [trainees, setTrainees] = useState<TraineeRow[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  function load(query = q) {
    setError(false);
    const qs = query ? `?q=${encodeURIComponent(query)}` : "";
    fetch(`/api/admin/trainees${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setTrainees)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setTrainees(null);
    load(q);
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Trainees</h1>
        <p className="mt-1 text-sm text-gray-500">Search and review trainee accounts and profiles.</p>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or username"
            className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
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
