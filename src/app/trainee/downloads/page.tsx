"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface DownloadDto {
  materialId: string;
  title: string;
  type: "PDF" | "DOCX" | "PPTX" | "VIDEO";
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  downloadedAt: string;
  isStale: boolean;
}

const TYPE_ICON: Record<DownloadDto["type"], string> = { PDF: "📄", DOCX: "📝", PPTX: "📊", VIDEO: "🎬" };

/**
 * M40 — "the trainee able to remove a downloaded item themselves,"
 * the real UI this milestone's own scope calls for. Honest about what
 * removal actually does here — see the DELETE route's own comment:
 * this drops the app's tracking of the download, not a file already
 * sitting on the trainee's own device, which this app has no way to
 * reach.
 */
export default function TraineeDownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadDto[] | null>(null);
  const [downloadsError, setDownloadsError] = useState(false);
  const { showToast } = useToast();

  function load() {
    setDownloadsError(false);
    fetch("/api/trainee/downloads")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDownloads)
      .catch(() => setDownloadsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(materialId: string) {
    const res = await fetch(`/api/trainee/downloads/${materialId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not remove. Try again.", "error");
      return;
    }
    showToast("Removed from your downloads.");
    load();
  }

  const nav = [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "My Downloads", href: "/trainee/downloads" },
    { label: "Introductions", href: "/trainee/introductions" },
    { label: "Job Board", href: "/trainee/job-postings" },
    { label: "Settings", href: "/trainee/settings" },
  ];

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">My Downloads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Materials you've downloaded for offline reading. Removing one here only clears it from this list — it
          doesn't delete the file already saved on your device.
        </p>

        <div className="mt-6 space-y-3">
          {downloadsError ? (
            <ErrorState message="We couldn't load your downloads." onRetry={load} />
          ) : downloads === null ? (
            <SkeletonList />
          ) : downloads.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't downloaded anything yet.</p>
          ) : (
            downloads.map((d) => (
              <Card key={d.materialId} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display font-semibold text-brand-ink">
                    {TYPE_ICON[d.type]} {d.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {d.courseTitle} · {d.lessonTitle}
                  </p>
                  {d.isStale && (
                    <p className="mt-1 text-xs font-medium text-brand-goldText">
                      Updated since you downloaded it —{" "}
                      <a href={`/trainee/courses/${d.courseId}`} className="underline">
                        re-download for the latest version
                      </a>
                      .
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(d.materialId)}
                  className="shrink-0 text-xs font-semibold text-brand-rose hover:underline"
                >
                  Remove
                </button>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
