"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface IntroductionDto {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  respondedAt: string | null;
  traineeName: string;
  traineeEmail: string | null;
  traineePhone: string | null;
  disclosedCertificates: { code: string; courseTitle: string }[];
}

const NAV = [
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

const STATUS_STYLE: Record<IntroductionDto["status"], string> = {
  PENDING: "text-brand-goldText",
  ACCEPTED: "text-brand-teal",
  DECLINED: "text-brand-rose",
};

/**
 * M33 — the employer's own view of what they've sent. Contact
 * information only ever renders when the API itself already decided
 * to include it (see that route's own comment) — this page never
 * re-derives "should I show this" from status alone, since the only
 * source of truth for that decision is the response itself.
 */
export default function EmployerIntroductionsPage() {
  const [requests, setRequests] = useState<IntroductionDto[] | null>(null);
  const [requestsError, setRequestsError] = useState(false);

  function load() {
    setRequestsError(false);
    fetch("/api/employer/introductions")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRequests)
      .catch(() => setRequestsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">My Introductions</h1>

        <div className="mt-6 space-y-3">
          {requestsError ? (
            <ErrorState message="We couldn't load your introductions." onRetry={load} />
          ) : requests === null ? (
            <SkeletonList />
          ) : requests.length === 0 ? (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="You haven't reached out to anyone yet"
              description="Browse discoverable trainees and express interest — your requests will show up here."
              action={
                <Button href="/employer/discover" size="sm">
                  Discover Trainees
                </Button>
              }
            />
          ) : (
            requests.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-brand-ink">{r.traineeName}</p>
                  <span className={`text-xs font-semibold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
                {r.status === "PENDING" && (
                  <p className="mt-1 text-xs text-gray-500">Waiting for the trainee to respond.</p>
                )}
                {r.status === "DECLINED" && (
                  <p className="mt-1 text-xs text-gray-500">This trainee chose not to connect.</p>
                )}
                {r.status === "ACCEPTED" && (
                  <div className="mt-2 text-sm text-gray-700">
                    {r.traineeEmail || r.traineePhone ? (
                      <>
                        {r.traineeEmail && <p>{r.traineeEmail}</p>}
                        {r.traineePhone && <p>{r.traineePhone}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">The trainee accepted but chose not to share contact info.</p>
                    )}
                    {r.disclosedCertificates.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.disclosedCertificates.map((c) => (
                          <li key={c.code} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                            {c.courseTitle}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
