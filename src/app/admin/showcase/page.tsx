"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import JobPostingMediaGallery, { JobPostingMediaItem } from "@/components/jobPostings/JobPostingMediaGallery";

interface ProjectDto {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  showcaseStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  trainee: { name: string };
  media: JobPostingMediaItem[];
}

const STATUS_STYLE: Record<ProjectDto["showcaseStatus"], string> = {
  PENDING_REVIEW: "text-brand-goldText",
  APPROVED: "text-brand-teal",
  REJECTED: "text-brand-rose",
};

/**
 * Community Showcase moderation queue — same Pending Review /
 * Previously Decided shape as /admin/job-postings, this feature's own
 * direct template (see POST .../showcase/[id]/decide's own comment).
 * No per-page SiteHeader call — new pages built after the admin
 * sidebar rollout don't need one; the sidebar provides navigation.
 */
export default function AdminShowcasePage() {
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/admin/showcase")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProjects)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/showcase/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not complete that action. Try again.", "error");
      return;
    }
    showToast(action === "APPROVE" ? "Project approved." : "Project rejected.");
    load();
  }

  /**
   * Moderation escape hatch — remove one inappropriate media item
   * without rejecting the whole post, same reasoning as the
   * job-postings page's own removeMedia (this route already allows
   * either the owning trainee or any admin).
   */
  async function removeMedia(projectId: string, mediaId: string) {
    setRemovingMediaId(mediaId);
    const res = await fetch(`/api/trainee/projects/${projectId}/media/${mediaId}`, { method: "DELETE" });
    setRemovingMediaId(null);
    if (!res.ok) {
      showToast("Could not remove media.", "error");
      return;
    }
    load();
  }

  const pending = projects?.filter((p) => p.showcaseStatus === "PENDING_REVIEW") ?? [];
  const decided = projects?.filter((p) => p.showcaseStatus !== "PENDING_REVIEW") ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Community Showcase Review</h1>
      <p className="mt-1 text-sm text-gray-500">Trainee project submissions, held until you approve or reject them.</p>

      <h2 className="mt-6 text-sm font-semibold text-gray-500">Pending Review ({pending.length})</h2>
      <div className="mt-2 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load showcase submissions." onRetry={load} />
        ) : projects === null ? (
          <SkeletonList />
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing waiting on review.</p>
        ) : (
          pending.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-brand-ink">{p.title}</p>
                  <p className="text-xs text-gray-500">by {p.trainee.name}</p>
                  {p.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{p.description}</p>}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-teal hover:underline">
                      {p.url}
                    </a>
                  )}
                  <JobPostingMediaGallery media={p.media} onRemove={(mediaId) => removeMedia(p.id, mediaId)} removingId={removingMediaId} />
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
                    <p className="text-xs text-gray-500">by {p.trainee.name}</p>
                  </div>
                  <span className={`text-xs font-semibold ${STATUS_STYLE[p.showcaseStatus]}`}>
                    {p.showcaseStatus.replace("_", " ")}
                  </span>
                </div>
                <JobPostingMediaGallery media={p.media} onRemove={(mediaId) => removeMedia(p.id, mediaId)} removingId={removingMediaId} />
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
