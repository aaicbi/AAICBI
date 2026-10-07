"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { MAX_COMMENT_LENGTH } from "@/lib/ecosystem/commentCore";

export interface CommentItem { id: string; body: string; createdAt: string; authorName: string; mine: boolean }

/** Comments under a video. Only signed-in trainees can write; anyone can read. Links are not allowed, and any comment can be reported. */
export default function VideoComments({ postId, initial, signedIn, nextPath }: { postId: string; initial: CommentItem[]; signedIn: boolean; nextPath: string }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/education-posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(typeof data.error === "string" ? data.error : "Could not post your comment.", "error"); return; }
    setItems((l) => [data, ...l]);
    setText("");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/education-comments/${id}`, { method: "DELETE" });
    if (res.ok) setItems((l) => l.filter((c) => c.id !== id));
  }

  async function report(id: string) {
    const res = await fetch(`/api/education-comments/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "OTHER" }) });
    showToast(res.ok ? "Thanks, we will take a look." : "Could not send your report.", res.ok ? "success" : "error");
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-10">
      <h2 id="comments-heading" className="font-display text-lg font-semibold text-brand-ink">Comments ({items.length})</h2>
      {signedIn ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <Textarea label="Add a comment" hideLabel value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_COMMENT_LENGTH} rows={3} placeholder="Say something kind or useful. No links, please." />
          <Button type="submit" size="sm" loading={busy} disabled={text.trim().length < 2}>Post comment</Button>
        </form>
      ) : (
        <p className="mt-2 text-sm text-gray-600"><Link href={`/trainee/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-brand-teal hover:underline">Sign in as a trainee</Link> to comment.</p>
      )}
      <ul className="mt-4 space-y-3">
        {items.length === 0 && <li className="text-sm text-gray-600">No comments yet.</li>}
        {items.map((c) => (
          <li key={c.id}>
            <Card>
              <p className="text-xs text-gray-500"><span className="font-semibold text-brand-ink">{c.authorName}</span> · {new Date(c.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{c.body}</p>
              {signedIn && (
                <button type="button" onClick={() => (c.mine ? remove(c.id) : report(c.id))} className="mt-2 text-xs font-semibold text-gray-500 hover:text-brand-teal">
                  {c.mine ? "Delete" : "Report"}
                </button>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
