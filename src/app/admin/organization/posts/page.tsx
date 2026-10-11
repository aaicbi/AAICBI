"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import PostCard from "@/components/posts/PostCard";
import type { PostView } from "@/lib/posts/posts";

type Row = PostView & { held: boolean; holdReason: string | null; appealed: boolean };

/** An organization's member posts: the published posts of its own trainees. It may keep one out of public view with a reason; the trainee is told and may appeal to the central team. */
export default function OrgMemberPostsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(false);
    fetch("/api/org/posts").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.posts)).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const r = await fetch(`/api/org/posts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast("Done.", "success");
    setAsking(null); setReason("");
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Member posts</h1>
      <p className="mt-1 text-sm text-gray-700">Posts by your own trainees that the AAICBI team has published. If one does not suit your organization you can keep it out of public view. Give a reason: the trainee reads it and can appeal to the central team.</p>
      <section className="mt-4 space-y-4" aria-live="polite">
        {error ? <ErrorState message="Could not load the posts." onRetry={load} /> : rows === null ? <SkeletonList rows={2} /> : rows.length === 0 ? <EmptyState title="No posts yet" description="Published posts by your trainees will appear here." /> : rows.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center gap-2">{p.held ? <Badge variant="danger">Hidden from the public</Badge> : <Badge variant="success">Public</Badge>}{p.appealed && <Badge variant="warning">The trainee appealed</Badge>}</div>
            {p.held && p.holdReason && <p className="mt-2 break-words text-sm text-gray-700">Your reason: {p.holdReason}</p>}
            <div className="mt-3"><PostCard post={p} /></div>
            {asking === p.id ? (
              <div className="mt-3 space-y-2">
                <Textarea label="Why should this post be hidden? (the trainee will read this)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} />
                <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setAsking(null); setReason(""); }}>Cancel</Button><Button size="sm" variant="danger" loading={busy === p.id} disabled={reason.trim().length < 5} onClick={() => act(p.id, { action: "block", reason })}>Hide the post</Button></div>
              </div>
            ) : (
              <div className="mt-3 flex justify-end gap-2">{p.held ? <Button size="sm" loading={busy === p.id} onClick={() => act(p.id, { action: "unblock" })}>Make it visible again</Button> : <Button size="sm" variant="secondary" onClick={() => { setAsking(p.id); setReason(""); }}>Hide from the public</Button>}</div>
            )}
          </Card>
        ))}
      </section>
    </main>
  );
}
