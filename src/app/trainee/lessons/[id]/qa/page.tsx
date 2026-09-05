"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface ThreadDto {
  id: string;
  title: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  _count: { posts: number };
}

/**
 * M41 — the trainee-facing entry point into a lesson's Q&A. A real
 * "New Thread" form, not just a list — creating a thread already
 * posts its first message in the same request (see the thread-create
 * route), so this doesn't need a separate "create thread" and "write
 * first post" step.
 */
export default function LessonQaPage({ params }: { params: { id: string } }) {
  const [threads, setThreads] = useState<ThreadDto[] | null>(null);
  const [threadsError, setThreadsError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setThreadsError(false);
    fetch(`/api/lessons/${params.id}/qa/threads`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setThreads)
      .catch(() => setThreadsError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function createThread() {
    setPosting(true);
    setError(null);
    const res = await fetch(`/api/lessons/${params.id}/qa/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setPosting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not post. Try again.");
      return;
    }
    setTitle("");
    setContent("");
    setShowForm(false);
    showToast("Thread posted.");
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
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Lesson Q&amp;A</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="text-sm">
              Ask a Question
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mt-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Question title"
              aria-label="Question title"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's your question?"
              aria-label="What's your question?"
              rows={3}
              className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            {error && <p className="mt-2 text-xs text-brand-rose">{error}</p>}
            <div className="mt-2 flex gap-2">
              <Button onClick={createThread} loading={posting} disabled={title.trim().length < 3 || !content.trim()}>
                Post
              </Button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {threadsError ? (
            <ErrorState message="We couldn't load questions." onRetry={load} />
          ) : threads === null ? (
            <SkeletonList />
          ) : threads.length === 0 ? (
            <p className="text-sm text-gray-500">No questions yet — be the first to ask one.</p>
          ) : (
            threads.map((t) => (
              <a key={t.id} href={`/trainee/lessons/${params.id}/qa/${t.id}`}>
                <Card className="transition-colors hover:border-brand-teal">
                  <p className="font-display font-semibold text-brand-ink">{t.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t.createdBy.name} · {t._count.posts} {t._count.posts === 1 ? "reply" : "replies"}
                  </p>
                </Card>
              </a>
            ))
          )}
        </div>
      </main>
    </>
  );
}
