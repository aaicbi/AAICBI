"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { STAGE_LABEL, type Stage } from "@/lib/startups/startupCore";

interface Row { id: string; name: string; tagline: string | null; problem: string | null; solution: string | null; industry: string | null; stage: Stage; status: string; verified: boolean; reviewNote: string | null; handle: string | null; team: number; submittedAt: string | null }
const BADGE: Record<string, "neutral" | "warning" | "success" | "danger"> = { DRAFT: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };
const FILTERS = [["PENDING", "Waiting"], ["APPROVED", "Public"], ["SUSPENDED", "Suspended"], ["ALL", "All"]] as const;

/** Startups: a super admin reads each one sent for review and approves, declines (with a reason), suspends, or marks it verified. */
export default function AdminStartupsPage() {
  const [status, setStatus] = useState<string>("PENDING");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [asking, setAsking] = useState<{ id: string; action: "reject" | "suspend" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(false);
    fetch(`/api/admin/startups?status=${status}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.startups)).catch(() => setError(true));
  }, [status]);
  useEffect(load, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/admin/startups/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast("Done.", "success");
    setAsking(null); setNote("");
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Startups</h1>
      <p className="mt-1 text-sm text-gray-700">A startup is public only after you approve it. Declining or suspending needs a reason the team will see. &quot;Verified&quot; is a separate mark: set it only when you have actually checked the startup.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map(([v, l]) => <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)} className={`min-h-[40px] rounded-full px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${status === v ? "bg-brand-action text-brand-onAccent" : "border border-brand-gray text-brand-ink"}`}>{l}</button>)}
      </div>
      <section className="mt-4 space-y-3" aria-live="polite">
        {error ? <ErrorState message="Could not load startups." onRetry={load} /> : rows === null ? <SkeletonList rows={2} /> : rows.length === 0 ? <EmptyState title="No startups here" description="Nothing matches this filter yet." /> : rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-semibold text-brand-ink">{r.name}</p>
              <Badge variant={BADGE[r.status] ?? "neutral"}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
              {r.verified && <Badge variant="success">Verified</Badge>}
              <Badge variant="neutral">{STAGE_LABEL[r.stage]}</Badge>
              {r.industry && <Badge variant="neutral">{r.industry}</Badge>}
              <span className="text-xs text-gray-600">{r.team} on team</span>
            </div>
            {r.tagline && <p className="mt-1 break-words text-sm text-gray-700">{r.tagline}</p>}
            {r.problem && <p className="mt-2 break-words text-sm text-brand-ink"><span className="font-semibold">Problem: </span>{r.problem}</p>}
            {r.solution && <p className="mt-1 break-words text-sm text-brand-ink"><span className="font-semibold">Solution: </span>{r.solution}</p>}
            {r.reviewNote && <p className="mt-2 text-xs text-gray-600">Last note: {r.reviewNote}</p>}
            {r.handle && <p className="mt-2 text-sm"><Link href={`/@${r.handle}`} className="font-semibold text-brand-teal hover:underline">Open the page (/@{r.handle})</Link></p>}
            {asking?.id === r.id ? (
              <div className="mt-3 space-y-2">
                <Textarea label={asking.action === "reject" ? "Why is it not approved? (the team will see this)" : "Why is it suspended? (the team will see this)"} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
                <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setAsking(null); setNote(""); }}>Cancel</Button><Button size="sm" variant="danger" loading={busy === r.id} disabled={note.trim().length < 5} onClick={() => act(r.id, { action: asking.action, note })}>{asking.action === "reject" ? "Decline" : "Suspend"}</Button></div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {r.status === "PENDING" && <><Button size="sm" variant="secondary" onClick={() => { setAsking({ id: r.id, action: "reject" }); setNote(""); }}>Decline</Button><Button size="sm" loading={busy === r.id} onClick={() => act(r.id, { action: "approve" })}>Approve</Button></>}
                {(r.status === "APPROVED" || r.status === "PENDING") && <Button size="sm" variant="secondary" onClick={() => { setAsking({ id: r.id, action: "suspend" }); setNote(""); }}>Suspend</Button>}
                {r.status === "SUSPENDED" && <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, { action: "reinstate" })}>Reinstate</Button>}
                {r.status === "APPROVED" && <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => act(r.id, { verified: !r.verified })}>{r.verified ? "Remove verified mark" : "Mark verified"}</Button>}
              </div>
            )}
          </Card>
        ))}
      </section>
    </main>
  );
}
