"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface JobPostingDto {
  id: string;
  title: string;
  description: string;
  closingDate: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
}

const NAV = [
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

const STATUS_STYLE: Record<JobPostingDto["status"], string> = {
  PENDING_REVIEW: "text-brand-goldText",
  APPROVED: "text-brand-teal",
  REJECTED: "text-brand-rose",
  EXPIRED: "text-gray-400",
};

function defaultClosingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * M34 — the actual "post a vacancy" flow. A required closing date
 * with a sensible default (30 days out), not left blank — matching
 * the API's own requirement that this can never be omitted.
 */
export default function EmployerJobPostingsPage() {
  const [postings, setPostings] = useState<JobPostingDto[] | null>(null);
  const [postingsError, setPostingsError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closingDate, setClosingDate] = useState(defaultClosingDate());
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setPostingsError(false);
    fetch("/api/employer/job-postings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPostings)
      .catch(() => setPostingsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    setError(null);
    const res = await fetch("/api/employer/job-postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        closingDate: new Date(closingDate + "T23:59:59").toISOString(),
      }),
    });
    setPosting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not post. Try again.");
      return;
    }
    setTitle("");
    setDescription("");
    setClosingDate(defaultClosingDate());
    showToast("Posting submitted for review.");
    load();
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Job Postings</h1>

        <Card className="mt-4">
          <p className="font-display font-semibold text-brand-ink">Post a Vacancy</p>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title"
              aria-label="Job title"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Job description"
              aria-label="Job description"
              rows={4}
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <div>
              <label className="text-xs font-semibold text-gray-600">Closing date</label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
            </div>
            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={posting}>
              Submit for Review
            </Button>
          </form>
        </Card>

        <div className="mt-6 space-y-3">
          {postingsError ? (
            <ErrorState message="We couldn't load your postings." onRetry={load} />
          ) : postings === null ? (
            <SkeletonList />
          ) : postings.length === 0 ? (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No postings yet"
              description="Use the form above to post your first vacancy."
            />
          ) : (
            postings.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                  <span className={`text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Closes {new Date(p.closingDate).toLocaleDateString()}</p>
                {(p.status === "APPROVED" || p.status === "EXPIRED") && (
                  <a href={`/employer/job-postings/${p.id}/applications`} className="mt-2 inline-block text-xs font-semibold text-brand-teal hover:underline">
                    View applications →
                  </a>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
