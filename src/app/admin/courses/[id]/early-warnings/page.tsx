"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface InactivityAlertRow {
  id: string;
  triggeredAt: string;
  trainee: { id: string; name: string; email: string; lastLoginAt: string | null };
}
interface FailedAttemptsAlertRow {
  id: string;
  triggeredAt: string;
  trainee: { id: string; name: string; email: string };
  exam: { title: string };
}

/**
 * M38 — Staff Early-Warning Dashboard. Loading this page is what
 * actually triggers the inactivity check server-side (see the API
 * route's own comment) — this app has no background job that could do
 * it on a schedule instead, so this page's own load genuinely is the
 * "next natural touchpoint" the whole design depends on, not just a
 * read-only view of something computed elsewhere.
 */
export default function EarlyWarningsPage({ params }: { params: { id: string } }) {
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlertRow[] | null>(null);
  const [failedAttemptsAlerts, setFailedAttemptsAlerts] = useState<FailedAttemptsAlertRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/${params.id}/early-warnings`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json();
        setInactivityAlerts(data.inactivityAlerts);
        setFailedAttemptsAlerts(data.failedAttemptsAlerts);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10 text-center text-gray-600">
          Course not found, or you don&apos;t have access to it.
        </main>
      </>
    );
  }

  const loading = inactivityAlerts === null || failedAttemptsAlerts === null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <a href={`/admin/courses/${params.id}`} className="text-sm text-brand-teal hover:underline">
          ← Back to course
        </a>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">⚠️ Early Warnings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Trainees who&apos;ve crossed a threshold you set for this course. Set or change the thresholds from the
          course page itself.
        </p>

        {loading ? (
          <div className="mt-6">
            <SkeletonList rows={3} />
          </div>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Inactivity</h2>
              <div className="mt-3 space-y-3">
                {inactivityAlerts!.length === 0 ? (
                  <EmptyState
                    illustration={<GrowthPathDoodle className="h-full w-full" />}
                    title="No inactivity alerts"
                    description="Either the threshold is off for this course, or every enrolled trainee has logged in recently."
                  />
                ) : (
                  inactivityAlerts!.map((a) => (
                    <Card key={a.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-semibold text-brand-ink">{a.trainee.name}</p>
                        <p className="text-xs text-gray-500">{a.trainee.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="danger">Inactive</Badge>
                        <p className="mt-1 text-xs text-gray-500">
                          Flagged {new Date(a.triggeredAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Failed Attempts</h2>
              <div className="mt-3 space-y-3">
                {failedAttemptsAlerts!.length === 0 ? (
                  <EmptyState
                    illustration={<GrowthPathDoodle className="h-full w-full" />}
                    title="No failed-attempt alerts"
                    description="Either the threshold is off for this course, or no trainee has crossed it on any module assessment."
                  />
                ) : (
                  failedAttemptsAlerts!.map((a) => (
                    <Card key={a.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-semibold text-brand-ink">{a.trainee.name}</p>
                        <p className="text-xs text-gray-500">
                          {a.trainee.email} · {a.exam.title}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="danger">Struggling</Badge>
                        <p className="mt-1 text-xs text-gray-500">
                          Flagged {new Date(a.triggeredAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
