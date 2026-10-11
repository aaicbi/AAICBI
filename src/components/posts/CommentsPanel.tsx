"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PostText } from "@/components/posts/PostCard";
import { useSocial } from "@/components/posts/SocialProvider";
import { COMMENT_MAX } from "@/lib/posts/interactionCore";
import type { CommentView } from "@/lib/posts/interactions";

function Who({ c }: { c: CommentView }) {
  return <Link href={`/@${c.author.handle}`} className="font-semibold text-brand-ink hover:underline">{c.author.name}</Link>;
}

function Composer({ placeholder, onSend, onCancel, autoFocus }: { placeholder: string; onSend: (body: string) => Promise<boolean>; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { signedIn, gate } = useSocial();
  return (
    <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!gate()) return; setBusy(true); const ok = await onSend(body); setBusy(false); if (ok) setBody(""); }}>
      <Textarea label={placeholder} hideLabel compact value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={COMMENT_MAX} placeholder={signedIn ? placeholder : "Create an account to join the conversation"} autoFocus={autoFocus} onFocus={() => { if (!signedIn) gate(); }} />
      <div className="flex justify-end gap-2">{onCancel && <Button type="button" size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>}<Button type="submit" size="sm" loading={busy} disabled={body.trim().length === 0}>Post</Button></div>
    </form>
  );
}

/** The comments under a post: threaded one level, readable by anyone, written by people with an account. */
export default function CommentsPanel({ postId, onCount }: { postId: string; onCount?: (n: number) => void }) {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const { act } = useSocial();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const r = await fetch(`/api/posts/${postId}/comments`);
    if (!r.ok) return setComments([]);
    const d = await r.json();
    setComments(d.comments);
    onCount?.(d.comments.reduce((n: number, c: CommentView) => n + (c.removed ? 0 : 1) + c.replies.filter((x) => !x.removed).length, 0));
  }, [postId, onCount]);
  useEffect(() => { load(); }, [load]);

  async function send(body: string, parentId?: string) {
    const res = await act(`/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, parentId }) }, `/post/${postId}`);
    if (res?.ok) { setReplying(null); await load(); return true; }
    return false;
  }
  async function remove(id: string) {
    if (!confirm("Remove this comment?")) return;
    const res = await act(`/api/comments/${id}`, { method: "DELETE" });
    if (res?.ok) load();
  }
  async function report(id: string) {
    const res = await act(`/api/posts/${postId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "OTHER", details: "Reported from the comments", commentId: id }) });
    if (res?.ok) showToast("Thank you. A reviewer will look at this comment.", "success");
  }

  const row = (c: CommentView, isReply = false) => (
    <li key={c.id} id={`comment-${c.id}`} className={`scroll-mt-24 ${isReply ? "ml-6 border-l-2 border-brand-gray pl-3" : ""}`}>
      {c.removed ? <p className="text-sm italic text-gray-600">This comment was removed.</p> : (
        <>
          <p className="text-sm"><Who c={c} /> <span className="text-xs text-gray-600">· {new Date(c.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span></p>
          <PostText text={c.body} lines={4} className="mt-0.5 text-sm text-brand-ink" />
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
            {!isReply && <button type="button" onClick={() => setReplying(replying === c.id ? null : c.id)} className="min-h-[32px] hover:text-brand-teal">Reply</button>}
            {c.mine ? <button type="button" onClick={() => remove(c.id)} className="min-h-[32px] hover:text-brand-rose">Delete</button> : <button type="button" onClick={() => report(c.id)} className="min-h-[32px] hover:text-brand-rose">Report</button>}
          </div>
          {replying === c.id && <div className="mt-2"><Composer placeholder={`Reply to ${c.author.name}`} autoFocus onCancel={() => setReplying(null)} onSend={(b) => send(b, c.id)} /></div>}
        </>
      )}
      {c.replies.length > 0 && <ul className="mt-3 space-y-3">{c.replies.map((r) => row(r, true))}</ul>}
    </li>
  );

  return (
    <div className="mt-3 space-y-4 border-t border-brand-gray pt-3" aria-label="Comments">
      <Composer placeholder="Write a comment" onSend={(b) => send(b)} />
      {comments === null ? <p className="text-sm text-gray-600">Loading comments…</p> : comments.length === 0 ? <p className="text-sm text-gray-600">No comments yet. Be the first.</p> : <ul className="space-y-4">{comments.map((c) => row(c))}</ul>}
    </div>
  );
}
