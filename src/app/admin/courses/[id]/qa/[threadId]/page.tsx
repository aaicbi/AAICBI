"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PostDto {
  id: string;
  authorType: "TRAINEE" | "STAFF";
  authorId: string;
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

/**
 * M41 — the actual moderation UI this whole milestone's scope was
 * built around. A warning/suspend/reinstate action right next to the
 * specific post staff is looking at, not a separate trainee-lookup
 * page — matching the moderation route's own reasoning: this action
 * is tied to a real post in a real thread, not an arbitrary trainee ID
 * typed in elsewhere.
 */
export default function StaffQaThreadPage({ params }: { params: { id: string; threadId: string } }) {
  const [thread, setThread] = useState<ThreadDetailDto | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [moderatingPostId, setModeratingPostId] = useState<string | null>(null);
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

  async function postReply() {
    setPosting(true);
    const res = await fetch(`/api/qa/threads/${params.threadId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply }),
    });
    setPosting(false);
    if (!res.ok) {
      showToast("Could not post. Try again.", "error");
      return;
    }
    setReply("");
    load();
  }

  // Optimistic — flips immediately, reverts on a failed request, the
  // same low-stakes-toggle pattern the lesson-complete toggle already
  // established.
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

  async function moderate(traineeId: string, action: "WARNING" | "SUSPENSION" | "REINSTATEMENT") {
    const reason = window.prompt(
      action === "WARNING"
        ? "Reason for this warning:"
        : action === "SUSPENSION"
          ? "Reason for suspension:"
          : "Reason for reinstating:"
    );
    if (!reason) return;
    setModeratingPostId(traineeId);
    const res = await fetch("/api/qa/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: params.threadId, traineeId, action, reason }),
    });
    setModeratingPostId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not complete that action.", "error");
      return;
    }
    const data = await res.json();
    if (action === "WARNING" && data.autoSuspended) {
      showToast("Warning issued — trainee has now been automatically suspended.", "success");
    } else if (action === "SUSPENSION" && data.alreadySuspended) {
      showToast("This trainee was already suspended — nothing changed.", "success");
    } else if (action === "REINSTATEMENT" && data.wasNotSuspended) {
      showToast("This trainee wasn't suspended — nothing changed.", "success");
    } else {
      showToast("Done.", "success");
    }
  }

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
        <a href={`/admin/courses/${params.id}/qa`} className="text-xs font-semibold text-brand-teal hover:underline">
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
                    {p.authorType === "TRAINEE" && (
                      <div className="flex gap-2">
                        <button
                          disabled={moderatingPostId === p.authorId}
                          onClick={() => moderate(p.authorId, "WARNING")}
                          className="text-xs font-semibold text-brand-goldText hover:underline disabled:opacity-50"
                        >
                          Warn
                        </button>
                        <button
                          disabled={moderatingPostId === p.authorId}
                          onClick={() => moderate(p.authorId, "SUSPENSION")}
                          className="text-xs font-semibold text-brand-rose hover:underline disabled:opacity-50"
                        >
                          Suspend
                        </button>
                        <button
                          disabled={moderatingPostId === p.authorId}
                          onClick={() => moderate(p.authorId, "REINSTATEMENT")}
                          className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50"
                        >
                          Reinstate
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleLike(p.id)}
                    className={`mt-1 flex items-center gap-1 text-xs font-semibold ${p.likedByMe ? "text-brand-rose" : "text-gray-400 hover:text-brand-rose"}`}
                  >
                    {p.likedByMe ? "♥" : "♡"} {p.likeCount > 0 && p.likeCount}
                  </button>
                </Card>
              ))}
            </div>

            <Card className="mt-4">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply as staff..."
                aria-label="Reply as staff"
                rows={3}
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
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
