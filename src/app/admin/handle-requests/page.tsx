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

interface Row { id: string; kind: string | null; currentHandle: string; handleNow: string | null; requestedHandle: string; reason: string; status: string; decisionNote: string | null; decidedByName: string | null; createdAt: string; decidedAt: string | null }
const KIND: Record<string, string> = { PERSON: "Member", TRAINING_ORG: "Training organization", EMPLOYER: "Employer", INVESTOR: "Investor", STAFF: "Staff", STARTUP: "Startup" };
const when = (v: string) => new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Handle change requests: a person asks with a reason, and only a super admin decides. */
export default function HandleRequestsPage() {
  const [status, setStatus] = useState<"PENDING" | "ALL">("PENDING");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [direct, setDirect] = useState({ currentHandle: "", handle: "", reason: "" });
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(false);
    fetch(`/api/admin/handle-requests?status=${status}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.requests)).catch(() => setError(true));
  }, [status]);
  useEffect(load, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    const res = await fetch(`/api/admin/handle-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(action === "approve" ? "Handle changed. The old one forwards to the new." : "Request declined.", "success");
    setRejecting(null);
    setNote("");
    load();
  }

  async function changeDirect(e: React.FormEvent) {
    e.preventDefault();
    setBusy("direct");
    const res = await fetch("/api/admin/handle-requests/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(direct) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(`Changed to @${d.handle}.`, "success");
    setDirect({ currentHandle: "", handle: "", reason: "" });
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Handle requests</h1>
      <p className="mt-1 text-sm text-gray-700">People ask to change their /@handle and say why. Approving changes it at once; the old handle is kept for them, forwards to the new one, and still finds them in search. Declining needs a reason so they can try again.</p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Show">
        {([["PENDING", "Waiting"], ["ALL", "All requests"]] as const).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)} className={`min-h-[40px] rounded-full px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${status === v ? "bg-brand-teal text-brand-onAccent" : "border border-brand-gray text-brand-ink"}`}>{l}</button>
        ))}
      </div>

      <section className="mt-4 space-y-3" aria-live="polite">
        {error ? <ErrorState message="Could not load the requests." onRetry={load} /> : rows === null ? <SkeletonList rows={2} /> : rows.length === 0 ? <EmptyState title="No requests" description={status === "PENDING" ? "Nothing is waiting for a decision." : "No one has asked to change a handle yet."} /> : rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "neutral"}>{r.status === "PENDING" ? "Waiting" : r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
              {r.kind && <Badge variant="neutral">{KIND[r.kind] ?? r.kind}</Badge>}
              <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">@{r.currentHandle} to @{r.requestedHandle}</p>
            </div>
            <p className="mt-2 break-words text-sm text-gray-700"><span className="font-semibold">Reason: </span>{r.reason}</p>
            <p className="mt-1 text-xs text-gray-600">Asked {when(r.createdAt)}{r.decidedAt ? ` · decided ${when(r.decidedAt)}${r.decidedByName ? ` by ${r.decidedByName}` : ""}` : ""}{r.decisionNote ? ` · Note: ${r.decisionNote}` : ""}</p>
            {r.status === "PENDING" && (rejecting === r.id ? (
              <div className="mt-3 space-y-2">
                <Textarea label="Why is it declined? (the person will see this)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} />
                <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setRejecting(null); setNote(""); }}>Cancel</Button><Button size="sm" variant="danger" loading={busy === r.id} disabled={note.trim().length < 5} onClick={() => decide(r.id, "reject")}>Decline request</Button></div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setRejecting(r.id); setNote(""); }}>Decline</Button><Button size="sm" loading={busy === r.id} onClick={() => decide(r.id, "approve")}>Approve</Button></div>
            ))}
          </Card>
        ))}
      </section>

      <Card className="mt-8">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Change a handle directly</h2>
        <p className="mt-1 text-sm text-gray-700">For accounts that cannot ask themselves, such as training organizations, or your own. The old handle is kept and forwards the same way.</p>
        <form onSubmit={changeDirect} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Current handle" value={direct.currentHandle} onChange={(e) => setDirect((d) => ({ ...d, currentHandle: e.target.value }))} placeholder="e.g. northwind-academy" autoCapitalize="none" />
          <Input label="New handle" value={direct.handle} onChange={(e) => setDirect((d) => ({ ...d, handle: e.target.value }))} placeholder="e.g. northwind" autoCapitalize="none" />
          <div className="sm:col-span-2"><Textarea label="Reason (kept on record)" value={direct.reason} onChange={(e) => setDirect((d) => ({ ...d, reason: e.target.value }))} rows={2} maxLength={500} /></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" size="sm" loading={busy === "direct"} disabled={direct.currentHandle.trim().length < 3 || direct.handle.trim().length < 3 || direct.reason.trim().length < 10}>Change handle</Button></div>
        </form>
      </Card>
    </main>
  );
}
