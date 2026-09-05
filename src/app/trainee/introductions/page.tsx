"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface IntroductionDto {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  message: string | null;
  createdAt: string;
  employer: { companyName: string; contactName: string };
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

/**
 * M33 — the actual accept/decline action, including the disclosure
 * choice at the exact moment it matters: contact information and
 * which certificates only ever reach the employer once this specific
 * choice is submitted, never before. Reuses the discoverability
 * route's own certificate list rather than a third, near-identical
 * endpoint — the same set of certs, just consumed in a different
 * context here.
 */
export default function TraineeIntroductionsPage() {
  const [requests, setRequests] = useState<IntroductionDto[] | null>(null);
  const [requestsError, setRequestsError] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [includeContactInfo, setIncludeContactInfo] = useState(false);
  const [certificates, setCertificates] = useState<CertificateOption[]>([]);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  function load() {
    setRequestsError(false);
    fetch("/api/trainee/introductions")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRequests)
      .catch(() => setRequestsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function startResponding(id: string) {
    setRespondingId(id);
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

  async function accept(id: string) {
    setBusy(true);
    const res = await fetch(`/api/trainee/introductions/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ACCEPT",
        includeContactInfo,
        certificateIds: certificates.filter((c) => c.included).map((c) => c.id),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      showToast("Could not accept. Try again.", "error");
      return;
    }
    setRespondingId(null);
    showToast("Accepted.");
    load();
  }

  async function decline(id: string) {
    setBusy(true);
    const res = await fetch(`/api/trainee/introductions/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DECLINE" }),
    });
    setBusy(false);
    if (!res.ok) {
      showToast("Could not decline. Try again.", "error");
      return;
    }
    setRespondingId(null);
    showToast("Declined.");
    load();
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Introductions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Employers who've expressed interest in you. Nothing is shared until you decide.
        </p>

        <div className="mt-6 space-y-3">
          {requestsError ? (
            <ErrorState message="We couldn't load your introductions." onRetry={load} />
          ) : requests === null ? (
            <SkeletonList />
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500">No introductions yet.</p>
          ) : (
            requests.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-brand-ink">{r.employer.companyName}</p>
                  {r.status !== "PENDING" && (
                    <span
                      className={`text-xs font-semibold ${r.status === "ACCEPTED" ? "text-brand-teal" : "text-brand-rose"}`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
                {r.message && <p className="mt-1 text-sm text-gray-600">{r.message}</p>}

                {r.status === "PENDING" && respondingId !== r.id && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => startResponding(r.id)}>
                      Review
                    </Button>
                  </div>
                )}

                {respondingId === r.id && (
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
                      <Button size="sm" onClick={() => accept(r.id)} loading={busy}>
                        Accept
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => decline(r.id)} loading={busy}>
                        Decline
                      </Button>
                      <button onClick={() => setRespondingId(null)} className="text-xs font-semibold text-gray-500">
                        Cancel
                      </button>
                    </div>
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
