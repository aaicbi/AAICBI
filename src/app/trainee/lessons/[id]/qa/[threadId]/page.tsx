"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PostDto {
  id: string;
  authorType: "TRAINEE" | "STAFF";
  authorName: string;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}
interface ThreadDetailDto {
  id: string;
  title: string;
  posts: PostDto[];
}

export default function QaThreadPage({ params }: { params: { id: string; threadId: string } }) {
  const [thread, setThread] = useState<ThreadDetailDto | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    fetch(`/api/qa/threads/${params.threadId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setThread)
      .catch(() => setThread(null));
  }

  useEffect(() => {
    load();
  }, []);

  // Optimistic — flips immediately, reverts on a failed request, the
  // same low-stakes-toggle pattern the lesson-complete toggle already
  // established (see that component's own comment).
  async function toggleLike(postId: string) {
    if (!thread) return;
    setThread({
      ...thread,
      posts: thread.posts.map((p) =>
        p.id === postId ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p
      ),
    });
    const res = await fetch(`/api/qa/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) {
      setThread((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) =>
                p.id === postId ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p
              ),
            }
          : prev
      );
      showToast("Could not update. Try again.", "error");
    }
  }

  async function postReply() {
    setPosting(true);
    setError(null);
    const res = await fetch(`/api/qa/threads/${params.threadId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply }),
    });
    setPosting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not post. Try again.");
      return;
    }
    setReply("");
    showToast("Reply posted.");
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
        <a href={`/trainee/lessons/${params.id}/qa`} className="text-xs font-semibold text-brand-teal hover:underline">
          ← Back to Q&amp;A
        </a>

        {thread === null ? (
          <SkeletonList />
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{thread.title}</h1>

            <div className="mt-4 space-y-3">
              {thread.posts.map((p) => (
                <Card key={p.id} className={p.authorType === "STAFF" ? "border-brand-teal bg-brand-teal/5" : ""}>
                  <p className="text-sm text-gray-800">{p.content}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {p.authorName}
                      {p.authorType === "STAFF" && <span className="ml-1 font-semibold text-brand-teal">· Staff</span>}
                      {" · "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => toggleLike(p.id)}
                      className={`flex items-center gap-1 text-xs font-semibold ${p.likedByMe ? "text-brand-rose" : "text-gray-400 hover:text-brand-rose"}`}
                    >
                      {p.likedByMe ? "♥" : "♡"} {p.likeCount > 0 && p.likeCount}
                    </button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="mt-4">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply..."
                aria-label="Write a reply"
                rows={3}
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              {error && <p className="mt-2 text-xs text-brand-rose">{error}</p>}
              <Button onClick={postReply} loading={posting} disabled={!reply.trim()} className="mt-2">
                Reply
              </Button>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
