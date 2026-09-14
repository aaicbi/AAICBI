"use client";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { ArrowRight } from "lucide-react";
import Icon from "@/components/ui/Icon";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import JobPostingMediaPicker, { StagedMedia } from "@/components/jobPostings/JobPostingMediaPicker";
import JobPostingMediaGallery, { JobPostingMediaItem } from "@/components/jobPostings/JobPostingMediaGallery";

interface JobPostingDto {
  id: string;
  title: string;
  description: string;
  closingDate: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  media: JobPostingMediaItem[];
}

const NAV = [
  { label: "Dashboard", href: "/employer/dashboard" },
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "My Profile", href: "/employer/profile" },
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
  const [skills, setSkills] = useState("");
  const [closingDate, setClosingDate] = useState(defaultClosingDate());
  const [stagedMedia, setStagedMedia] = useState<StagedMedia[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const [addingMediaTo, setAddingMediaTo] = useState<string | null>(null);
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
        skillNames: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    if (!res.ok) {
      setPosting(false);
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not post. Try again.");
      return;
    }
    const created = await res.json();

    // The posting exists now, so staged files (picked before the
    // posting had an id at all) can finally be uploaded. Uploaded
    // sequentially, not in parallel — MAX_MEDIA_PER_POSTING is
    // enforced server-side per request, and a handful of small files
    // uploading one after another is not a meaningful latency concern
    // here. A failed upload never rolls back the posting itself
    // (already succeeded) — it's surfaced as a toast so the employer
    // can retry adding that one file from the list below.
    let mediaFailures = 0;
    for (const staged of stagedMedia) {
      const formData = new FormData();
      formData.append("file", staged.file);
      const mediaRes = await fetch(`/api/job-postings/${created.id}/media`, { method: "POST", body: formData });
      if (!mediaRes.ok) mediaFailures++;
      URL.revokeObjectURL(staged.previewUrl);
    }

    setPosting(false);
    setTitle("");
    setDescription("");
    setSkills("");
    setClosingDate(defaultClosingDate());
    setStagedMedia([]);
    showToast(
      mediaFailures > 0
        ? `Posting submitted, but ${mediaFailures} media file${mediaFailures === 1 ? "" : "s"} failed to upload. You can add it below.`
        : "Posting submitted for review.",
      mediaFailures > 0 ? "error" : "success"
    );
    load();
  }

  async function addMediaToPosting(postingId: string, file: File) {
    setAddingMediaTo(postingId);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/job-postings/${postingId}/media`, { method: "POST", body: formData });
    setAddingMediaTo(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not upload media.", "error");
      return;
    }
    load();
  }

  async function removeMedia(postingId: string, mediaId: string) {
    setRemovingMediaId(mediaId);
    const res = await fetch(`/api/job-postings/${postingId}/media/${mediaId}`, { method: "DELETE" });
    setRemovingMediaId(null);
    if (!res.ok) {
      showToast("Could not remove media.", "error");
      return;
    }
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
              <label className="text-xs font-semibold text-gray-600">Skills you're hiring for (comma-separated, optional)</label>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. React, SQL, Data Analysis"
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
            </div>
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
            <JobPostingMediaPicker staged={stagedMedia} onChange={setStagedMedia} />
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

                <JobPostingMediaGallery
                  media={p.media}
                  onRemove={(mediaId) => removeMedia(p.id, mediaId)}
                  removingId={removingMediaId}
                />
                {p.media.length < 5 && (
                  <PostingMediaAddButton
                    postingId={p.id}
                    busy={addingMediaTo === p.id}
                    onFileSelected={(file) => addMediaToPosting(p.id, file)}
                  />
                )}

                {(p.status === "APPROVED" || p.status === "EXPIRED") && (
                  <a href={`/employer/job-postings/${p.id}/applications`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:underline">
                    View applications <Icon icon={ArrowRight} size="sm" />
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

/** A tiny file-input trigger for adding one more media item to an already-created posting — separate from JobPostingMediaPicker, which stages files before a posting id exists at all. */
function PostingMediaAddButton({
  busy,
  onFileSelected,
}: {
  postingId: string;
  busy: boolean;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFileSelected(file);
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="text-xs font-semibold text-brand-teal hover:underline disabled:opacity-60"
      >
        {busy ? "Uploading..." : "+ Add media"}
      </button>
    </div>
  );
}
