"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface ApplicationDto {
  id: string;
  createdAt: string;
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

/**
 * M35 — the employer's own view of who applied. Contact information
 * only ever renders when the API itself already decided to include
 * it, the same "never re-derive the disclosure decision on this
 * page" discipline M33's employer-introductions view already applies.
 */
export default function EmployerApplicationsPage({ params }: { params: { id: string } }) {
  const [applications, setApplications] = useState<ApplicationDto[] | null>(null);
  const [applicationsError, setApplicationsError] = useState(false);

  function load() {
    setApplicationsError(false);
    fetch(`/api/employer/job-postings/${params.id}/applications`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setApplications)
      .catch(() => setApplicationsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <a href="/employer/job-postings" className="text-xs font-semibold text-brand-teal hover:underline">
          ← Back to Job Postings
        </a>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Applications</h1>

        <div className="mt-6 space-y-3">
          {applicationsError ? (
            <ErrorState message="We couldn't load applications." onRetry={load} />
          ) : applications === null ? (
            <SkeletonList />
          ) : applications.length === 0 ? (
            <p className="text-sm text-gray-500">No applications yet.</p>
          ) : (
            applications.map((a) => (
              <Card key={a.id}>
                <p className="font-display font-semibold text-brand-ink">{a.traineeName}</p>
                {a.traineeEmail || a.traineePhone ? (
                  <div className="mt-1 text-sm text-gray-700">
                    {a.traineeEmail && <p>{a.traineeEmail}</p>}
                    {a.traineePhone && <p>{a.traineePhone}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">This applicant chose not to share contact info.</p>
                )}
                {a.disclosedCertificates.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.disclosedCertificates.map((c) => (
                      <li key={c.code} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                        {c.courseTitle}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
