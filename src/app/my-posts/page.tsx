"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { STATUS_LABEL, canEdit, canSubmit, canWithdraw, type PostStatus } from "@/lib/posts/postCore";
import type { PostView } from "@/lib/posts/posts";

const BADGE = (s: PostStatus) => (s === "PUBLISHED" ? "success" : s === "REJECTED" || s === "SUSPENDED" ? "danger" : s === "DRAFT" ? "neutral" : "warning") as "success" | "danger" | "neutral" | "warning";

/** My posts: everything I (or the startup or organization I post for) wrote, with its review status and what to do next. */
export default function MyPostsPage() {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [state, setState] = useState<"ok" | "signedout" | "failed">("ok");
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    fetch("/api/posts/mine").then(async (r) => { if (r.status === 401) return setState("signedout"); if (!r.ok) return setState("failed"); setPosts((await r.json()).posts); setState("ok"); }).catch(() => setState("failed"));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, path: string, method = "POST") {
    setBusy(id);
    const r = await fetch(`/api/posts/${id}${path}`, { method });
    setBusy(null);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return showToast(d.error ?? "That did not work.", "error");
    load();
  }

  return (
    <>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-semibold text-brand-ink">My posts</h1><Button href="/compose" size="sm">New post</Button></div>
        {state === "signedout" ? <Card className="mt-4"><p className="text-sm text-gray-700">Please sign in to see your posts.</p></Card> : state === "failed" ? <div className="mt-4"><ErrorState message="Could not load your posts." onRetry={load} /></div> : !posts ? <div className="mt-4"><SkeletonList rows={3} /></div> : posts.length === 0 ? <div className="mt-6"><EmptyState title="No posts yet" description="Share what you learned or built. A reviewer checks it before it appears." /></div> : (
          <ul className="mt-4 space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={BADGE(p.status)}>{STATUS_LABEL[p.status]}</Badge>
                    {p.actingAs && <Badge variant="neutral">For {p.actingAs.name}</Badge>}
                    {p.orgBlockedAt && <Badge variant="danger">Hidden by the organization</Badge>}
                    <span className="text-xs text-gray-600">{new Date(p.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 break-words text-sm text-brand-ink">{p.title ? <span className="font-semibold">{p.title}. </span> : null}{p.body || (p.youtubeId ? "A YouTube video" : `${p.images.length} image${p.images.length === 1 ? "" : "s"}`)}</p>
                  {(p.status === "CHANGES_REQUESTED" || p.status === "REJECTED" || p.status === "SUSPENDED") && p.reviewNote && <p className="mt-2 rounded-lg bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">Reviewer: {p.reviewNote}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button href={`/post/${p.id}`} size="sm" variant="secondary">View</Button>
                    {canEdit(p.status) && <Button href={`/compose?edit=${p.id}`} size="sm" variant="secondary">Edit</Button>}
                    {canSubmit(p.status) && <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, "/submit")}>{p.status === "CHANGES_REQUESTED" ? "Send again for review" : "Submit for review"}</Button>}
                    {canWithdraw(p.status) && <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => act(p.id, "/withdraw")}>Take back to edit</Button>}
                    <Button size="sm" variant="danger" loading={busy === p.id} onClick={() => { if (confirm("Delete this post for good?")) act(p.id, "", "DELETE"); }}>Delete</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm"><Link href="/feed" className="font-semibold text-brand-teal hover:underline">Back to the feed</Link></p>
      </main>
    </>
  );
}
