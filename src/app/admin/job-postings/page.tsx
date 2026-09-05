"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface JobPostingDto {
  id: string;
  title: string;
  description: string;
  closingDate: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  aiFlagged: boolean;
  aiFlagReason: string | null;
  createdAt: string;
  employer: { companyName: string };
}

const STATUS_STYLE: Record<JobPostingDto["status"], string> = {
  PENDING_REVIEW: "text-brand-goldText",
  APPROVED: "text-brand-teal",
  REJECTED: "text-brand-rose",
  EXPIRED: "text-gray-400",
};

/**
 * M34/M36 — the real review queue AI screening feeds into, never
 * replaces, now showing every posting, not just the pending ones.
 * Audit finding, closed here: staff previously had no way to see a
 * posting once it left PENDING_REVIEW at all, meaning M36's own
 * requirement that an expired posting "stay visible to staff
 * themselves as expired" was genuinely unfulfilled — fixed by
 * splitting into "Pending Review" and "Previously Decided" sections,
 * the same shape M31's employer review page already uses. Flagged
 * postings still render first within the pending group and are still
 * visually distinguished, but every posting — flagged or not — still
 * needs the same explicit staff decision; nothing here is pre-approved
 * or auto-hidden based on the AI's own verdict.
 */
export default function AdminJobPostingsPage() {
  const [postings, setPostings] = useState<JobPostingDto[] | null>(null);
  const [postingsError, setPostingsError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setPostingsError(false);
    fetch("/api/admin/job-postings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPostings)
      .catch(() => setPostingsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/job-postings/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not complete that action. Try again.", "error");
      return;
    }
    showToast(action === "APPROVE" ? "Posting approved." : "Posting rejected.");
    load();
  }

  const pending = postings?.filter((p) => p.status === "PENDING_REVIEW") ?? [];
  const decided = postings?.filter((p) => p.status !== "PENDING_REVIEW") ?? [];

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
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Job Posting Review</h1>

        <h2 className="mt-6 text-sm font-semibold text-gray-500">Pending Review ({pending.length})</h2>
        <div className="mt-2 space-y-3">
          {postingsError ? (
            <ErrorState message="We couldn't load job postings." onRetry={load} />
          ) : postings === null ? (
            <SkeletonList />
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing waiting on review.</p>
          ) : (
            pending.map((p) => (
              <Card key={p.id} className={p.aiFlagged ? "border-brand-gold bg-brand-goldLight/40" : ""}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                    <p className="text-xs text-gray-500">
                      {p.employer.companyName} · Closes {new Date(p.closingDate).toLocaleDateString()}
                    </p>
                    {p.aiFlagged && (
                      <p className="mt-1 text-xs font-semibold text-brand-goldText">⚠ {p.aiFlagReason}</p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{p.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => decide(p.id, "APPROVE")} loading={busyId === p.id}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => decide(p.id, "REJECT")} loading={busyId === p.id}>
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
              {decided.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                      <p className="text-xs text-gray-500">
                        {p.employer.companyName} · Closes {new Date(p.closingDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
