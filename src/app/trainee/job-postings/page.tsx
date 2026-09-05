"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface JobPostingDto {
  id: string;
  title: string;
  description: string;
  closingDate: string;
  employer: { companyName: string };
}
interface CertificateOption {
  id: string;
  courseTitle: string;
  revoked: boolean;
  included: boolean;
}

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "Introductions", href: "/trainee/introductions" },
  { label: "Job Board", href: "/trainee/job-postings" },
  { label: "Settings", href: "/trainee/settings" },
];

// Trust-pass addition — "Closing soon" only ever for a genuinely near
// deadline (within 3 days); anything further out just shows the plain
// date, since "closes in 47 days" isn't a useful urgency signal the
// way a real calendar date already is at that distance.
function closingLabel(closingDate: string): string {
  const daysLeft = Math.ceil((new Date(closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) return daysLeft <= 1 ? "Closing today" : `Closing in ${daysLeft} days`;
  return `Closes ${new Date(closingDate).toLocaleDateString()}`;
}

/**
 * M35 — the job board itself, with the same per-application
 * disclosure choice built directly into applying, matching M33's
 * accept flow. Reuses the discoverability route's own certificate
 * list rather than a third, near-identical endpoint — the same
 * pattern already established there.
 */
export default function TraineeJobBoardPage() {
  const [postings, setPostings] = useState<JobPostingDto[] | null>(null);
  const [notDiscoverable, setNotDiscoverable] = useState(false);
  const [postingsError, setPostingsError] = useState(false);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [includeContactInfo, setIncludeContactInfo] = useState(false);
  const [certificates, setCertificates] = useState<CertificateOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  function load() {
    setPostingsError(false);
    fetch("/api/trainee/job-postings")
      .then((r) => {
        if (r.status === 403) {
          setNotDiscoverable(true);
          return [];
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then(setPostings)
      .catch(() => setPostingsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function startApplying(id: string) {
    setApplyingTo(id);
    setIncludeContactInfo(false);
    const res = await fetch("/api/trainee/discoverability");
    if (res.ok) {
      const data = await res.json();
      setCertificates(data.certificates.map((c: CertificateOption) => ({ ...c, included: false })));
    }
  }

  function toggleCertificate(id: string) {
    setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, included: !c.included } : c)));
  }

  async function submitApplication(id: string) {
    setBusy(true);
    const res = await fetch(`/api/trainee/job-postings/${id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeContactInfo,
        certificateIds: certificates.filter((c) => c.included).map((c) => c.id),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not apply. Try again.", "error");
      return;
    }
    setApplyingTo(null);
    setApplied((prev) => new Set(prev).add(id));
    showToast("Application submitted.");
  }

  if (notDiscoverable) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-sm text-gray-600">
            Turn on discoverability in your{" "}
            <a href="/trainee/settings" className="font-semibold text-brand-teal hover:underline">
              settings
            </a>{" "}
            to browse job postings.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Job Board</h1>

        <div className="mt-6 space-y-3">
          {postingsError ? (
            <ErrorState message="We couldn't load the job board." onRetry={load} />
          ) : postings === null ? (
            <SkeletonList />
          ) : postings.length === 0 ? (
            <p className="text-sm text-gray-500">No open postings right now.</p>
          ) : (
            postings.map((p) => (
              <Card key={p.id}>
                <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>{p.employer.companyName}</span>
                  <Badge variant="success">✓ Verified Employer</Badge>
                  <span>·</span>
                  <span>{closingLabel(p.closingDate)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{p.description}</p>

                {applied.has(p.id) ? (
                  <p className="mt-3 text-xs font-semibold text-brand-teal">✓ Applied</p>
                ) : applyingTo === p.id ? (
                  <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeContactInfo}
                        onChange={(e) => setIncludeContactInfo(e.target.checked)}
                      />
                      Share my contact information
                    </label>
                    {certificates.filter((c) => !c.revoked).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600">Certificates to share</p>
                        <div className="mt-1 space-y-1">
                          {certificates
                            .filter((c) => !c.revoked)
                            .map((c) => (
                              <label key={c.id} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={c.included} onChange={() => toggleCertificate(c.id)} />
                                {c.courseTitle}
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => submitApplication(p.id)} loading={busy}>
                        Submit Application
                      </Button>
                      <button onClick={() => setApplyingTo(null)} className="text-xs font-semibold text-gray-500">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => startApplying(p.id)} className="mt-3">
                    Apply
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
