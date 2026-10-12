"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import PostCard from "@/components/posts/PostCard";
import type { QueueItem } from "@/lib/review/queue";
import type { QueueFilter } from "@/lib/review/reviewCore";

type Counts = Record<QueueFilter, number>;
const FILTERS: Array<[QueueFilter, string]> = [["all", "Everything"], ["posts", "Posts"], ["loop", "Loop questions"], ["appeals", "Appeals"], ["reports", "Reports"], ["escalated", "Escalated"]];
type Pending = { id: string; action: string } | null;
const when = (v: string) => new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const PRIORITY: Record<string, "danger" | "warning" | "neutral"> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

/** The review team's inbox: posts, appeals of organization holds, and Loop's questions in one list. Reviewers decide, or escalate to the super admin with a reason. */
export default function ReviewInboxPage() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [data, setData] = useState<{ items: QueueItem[]; counts: Counts; me: { name: string; isSuperAdmin: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState({ question: "", answer: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    fetch(`/api/admin/review?filter=${filter}`).then(async (r) => { if (r.status === 403) return setError("You are not a reviewer. Ask a super admin for reviewer access."); if (!r.ok) return setError("Could not load the inbox."); setData(await r.json()); }).catch(() => setError("Could not load the inbox."));
  }, [filter]);
  useEffect(load, [load]);

  const start = (id: string, action: string, item?: QueueItem) => {
    setPending({ id, action });
    setNote("");
    if (item?.kind === "LOOP") setAnswer({ question: item.text.charAt(0).toUpperCase() + item.text.slice(1), answer: "" });
  };

  async function send(item: QueueItem, action: string, extra: Record<string, unknown> = {}) {
    setBusy(item.id);
    const path = item.kind === "POST" ? `posts/${item.id}` : item.kind === "APPEAL" ? `appeals/${item.id}` : item.kind === "REPORT" ? `reports/${item.id}` : `loop/${item.id}`;
    const res = await fetch(`/api/admin/review/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note, ...extra }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast("Done.", "success");
    setPending(null);
    setNote("");
    load();
  }

  const reasonBox = (item: QueueItem, label: string, action: string, danger = false) => (
    <div className="mt-3 space-y-2">
      <Textarea label={label} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
      <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPending(null)}>Cancel</Button><Button size="sm" variant={danger ? "danger" : "primary"} loading={busy === item.id} disabled={note.trim().length < 5} onClick={() => send(item, action)}>Confirm</Button></div>
    </div>
  );

  function actions(item: QueueItem) {
    if (!data) return null;
    const boss = data.me.isSuperAdmin;
    if (item.escalated && !boss) return <p className="mt-3 rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText">Escalated to a super admin, who will decide it.</p>;
    const open = pending?.id === item.id ? pending.action : null;
    const buttons: React.ReactNode[] = [];
    const add = (key: string, label: string, onClick: () => void, variant: "primary" | "secondary" | "danger" = "secondary") => buttons.push(<Button key={key} size="sm" variant={variant} loading={busy === item.id && key === "direct"} onClick={onClick}>{label}</Button>);
    if (item.kind === "REPORT") {
      add("action", item.targetKind === "COMMENT" ? "Remove the comment" : "Take the post down", () => start(item.id, "action"), "primary");
      add("dismiss", "Dismiss the report", () => start(item.id, "dismiss"));
    } else if (item.kind === "POST") {
      add("direct", "Approve and publish", () => send(item, "approve"), "primary");
      add("changes", "Request changes", () => start(item.id, "request_changes"));
      add("reject", "Reject", () => start(item.id, "reject"));
    } else if (item.kind === "APPEAL") {
      add("lift", "Lift the hold", () => start(item.id, "lift"), "primary");
      add("uphold", "Keep the hold", () => start(item.id, "uphold"));
    } else {
      add("answer", "Write the answer", () => start(item.id, "answer", item), "primary");
      add("reject", "Decline the question", () => start(item.id, "reject"));
    }
    if (!boss && !item.escalated) add("escalate", "Escalate to the super admin", () => start(item.id, "escalate"));
    if (boss && item.escalated) add("return", "Send back to reviewers", () => send(item, "return"));
    return (
      <>
        <div className="mt-3 flex flex-wrap justify-end gap-2">{buttons}</div>
        {open === "request_changes" && reasonBox(item, "What should the author change? (they will read this)", "request_changes")}
        {open === "reject" && reasonBox(item, item.kind === "LOOP" ? "Why should Loop not answer this? (kept in the history)" : "Why is it not approved? (the author will read this)", "reject", true)}
        {open === "lift" && reasonBox(item, "Why are you lifting the organization's hold? (the author will read this)", "lift")}
        {open === "uphold" && reasonBox(item, "Why does the hold stay? (the author will read this)", "uphold", true)}
        {open === "action" && reasonBox(item, "What are you doing, and why? (kept in the history)", "action", true)}
        {open === "dismiss" && reasonBox(item, "Why does this not break the rules? (kept in the history)", "dismiss")}
        {open === "escalate" && reasonBox(item, "Why should a super admin decide this?", "escalate")}
        {open === "answer" && item.kind === "LOOP" && (
          <div className="mt-3 space-y-2">
            <Input label="The question, as Loop will know it" value={answer.question} onChange={(e) => setAnswer((a) => ({ ...a, question: e.target.value }))} maxLength={200} />
            <Textarea label="The answer Loop will give everyone" value={answer.answer} onChange={(e) => setAnswer((a) => ({ ...a, answer: e.target.value }))} rows={4} maxLength={600} hint={`${answer.answer.trim().length}/600. Plain, friendly words. No prices or dates that may change.`} />
            <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setPending(null)}>Cancel</Button><Button size="sm" loading={busy === item.id} disabled={answer.answer.trim().length < 10 || answer.question.trim().length < 3} onClick={() => send(item, "answer", { question: answer.question, answer: answer.answer })}>Approve this answer</Button></div>
          </div>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Review inbox</h1>
      <p className="mt-1 text-sm text-gray-700">Posts waiting for a decision, authors&apos; appeals of an organization&apos;s hold, and questions Loop could not answer. Decide what you can; escalate an unusual case to a super admin with a reason.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map(([v, l]) => <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={`min-h-[40px] rounded-full px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${filter === v ? "bg-brand-action text-brand-onAccent" : "border border-brand-gray text-brand-ink"}`}>{l}{data ? ` ${data.counts[v]}` : ""}</button>)}
      </div>
      <section className="mt-4 space-y-4" aria-live="polite">
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <SkeletonList rows={3} /> : data.items.length === 0 ? <EmptyState title="Nothing waiting" description="The inbox is clear for this filter." /> : data.items.map((item) => (
          <Card key={`${item.kind}-${item.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{item.kind === "POST" ? "Post" : item.kind === "APPEAL" ? "Appeal" : item.kind === "REPORT" ? "Report" : "Loop question"}</Badge>
              {item.escalated && <Badge variant="warning">Escalated</Badge>}
              {item.kind === "LOOP" && <Badge variant={PRIORITY[item.priority] ?? "neutral"}>{item.priority.toLowerCase()} priority</Badge>}
              <span className="text-xs text-gray-600">Waiting since {when(item.waitingSince)}</span>
            </div>
            {item.escalated && item.escalationNote && <p className="mt-2 break-words text-sm text-brand-goldText">Escalated{item.escalatedByName ? ` by ${item.escalatedByName}` : ""}: {item.escalationNote}</p>}
            {(item.kind === "POST" || item.kind === "APPEAL" || item.kind === "REPORT") && <div className="mt-3"><PostCard post={item.post} /></div>}
            {item.kind === "REPORT" && (
              <div className="mt-3 space-y-1 rounded-xl bg-brand-sand p-3 text-sm">
                <p><span className="font-semibold">Reported {item.targetKind === "COMMENT" ? "a comment" : "this post"}:</span> {item.reason}{item.details ? ` · ${item.details}` : ""}</p>
                {item.commentBody && <p className="break-words"><span className="font-semibold">The comment: </span>{item.commentBody}</p>}
                <p className="text-xs text-gray-600">Reported by {item.reporterName ?? "someone"}{item.reportCount > 1 ? ` and ${item.reportCount - 1} other${item.reportCount > 2 ? "s" : ""}` : ""}.</p>
              </div>
            )}
            {item.kind === "APPEAL" && (
              <div className="mt-3 space-y-1 rounded-xl bg-brand-sand p-3 text-sm">
                <p className="break-words"><span className="font-semibold">The organization hid it because: </span>{item.orgBlockReason ?? "no reason recorded"}</p>
                <p className="break-words"><span className="font-semibold">The author says: </span>{item.appealNote}</p>
              </div>
            )}
            {item.kind === "LOOP" && (
              <div className="mt-3 space-y-1 text-sm">
                <p className="break-words font-semibold text-brand-ink">&ldquo;{item.text}&rdquo;</p>
                <p className="text-gray-700">Asked {item.asked} time{item.asked === 1 ? "" : "s"}{Object.keys(item.roleCounts).length ? ` by ${Object.entries(item.roleCounts).map(([r, n]) => `${r} ${n}`).join(", ")}` : ""}. Why it is here: {item.reason.replace(/_/g, " ").toLowerCase()}.</p>
                {item.variants.length > 0 && <p className="break-words text-gray-700">Also asked as: {item.variants.map((v) => `“${v}”`).join(" · ")}</p>}
                {item.attempted && <p className="break-words text-gray-700">Closest answer Loop tried: {item.attempted}</p>}
              </div>
            )}
            {"history" in item && item.history.length > 0 && (
              <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-gray-700">History ({item.history.length})</summary>
                <ul className="mt-2 space-y-1">{item.history.map((h, i) => <li key={i} className="break-words text-xs text-gray-700">{when(h.createdAt)} · {h.action.replace(/_/g, " ").toLowerCase()}{h.actorName ? ` · ${h.actorName}` : ""}{h.note ? ` · ${h.note}` : ""}</li>)}</ul>
              </details>
            )}
            {actions(item)}
          </Card>
        ))}
      </section>
    </main>
  );
}
