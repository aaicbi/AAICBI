"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface EmployerDto {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  registrationNumber: string;
  phone: string;
  website: string | null;
  linkedinUrl: string | null;
  otherSocialUrl: string | null;
  isFreeEmailProvider: boolean;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedBy: { name: string } | null;
}

/**
 * M31 — the real deliverable behind "no open self-signup": the review
 * queue plus the actual approve/reject action. SUPER_ADMIN/ADMIN only,
 * matching the API's own scoping — a genuinely platform-wide trust
 * decision, not a course-scoped one.
 *
 * Audit finding, closed here: this used to show only company name,
 * contact name, and email — nothing an admin could actually verify.
 * Now surfaces the required registration number and phone directly,
 * the optional website/LinkedIn/social links as real clickable links
 * when provided, and a visible flag when the work email is at a free
 * consumer provider — a genuine, well-known signal worth seeing before
 * deciding, not enforced automatically.
 */
export default function AdminEmployersPage() {
  const [employers, setEmployers] = useState<EmployerDto[] | null>(null);
  const [employersError, setEmployersError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setEmployersError(false);
    fetch("/api/admin/employers")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEmployers)
      .catch(() => setEmployersError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/employers/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not complete that action. Try again.", "error");
      return;
    }
    showToast(action === "APPROVE" ? "Employer approved." : "Employer rejected.");
    load();
  }

  const pending = employers?.filter((e) => e.approvalState === "PENDING") ?? [];
  const decided = employers?.filter((e) => e.approvalState !== "PENDING") ?? [];

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Employer Accounts</h1>

        <h2 className="mt-6 text-sm font-semibold text-gray-500">Pending Review ({pending.length})</h2>
        <div className="mt-2 space-y-3">
          {employersError ? (
            <ErrorState message="We couldn't load employers." onRetry={load} />
          ) : employers === null ? (
            <SkeletonList />
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing waiting on review.</p>
          ) : (
            pending.map((e) => (
              <Card key={e.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{e.companyName}</p>
                    <p className="text-xs text-gray-500">
                      {e.contactName} · {e.email}
                      {e.isFreeEmailProvider && (
                        <span className="ml-1 font-semibold text-brand-goldText">⚠ free email provider</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Reg. no. {e.registrationNumber} · {e.phone}
                    </p>
                    {(e.website || e.linkedinUrl || e.otherSocialUrl) && (
                      <p className="mt-1 flex gap-3 text-xs">
                        {e.website && (
                          <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                            Website
                          </a>
                        )}
                        {e.linkedinUrl && (
                          <a href={e.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                            LinkedIn
                          </a>
                        )}
                        {e.otherSocialUrl && (
                          <a href={e.otherSocialUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                            Other
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => decide(e.id, "APPROVE")} loading={busyId === e.id}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => decide(e.id, "REJECT")} loading={busyId === e.id}>
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {decided.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-semibold text-gray-500">Previously Decided</h2>
            <div className="mt-2 space-y-3">
              {decided.map((e) => (
                <Card key={e.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{e.companyName}</p>
                    <p className="text-xs text-gray-500">
                      {e.contactName} · {e.email}
                      {e.approvedBy && ` · decided by ${e.approvedBy.name}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${e.approvalState === "APPROVED" ? "text-brand-teal" : "text-brand-rose"}`}
                  >
                    {e.approvalState === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
