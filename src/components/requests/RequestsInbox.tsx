"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { STATUS_LABEL, type ChangeRequestStatus } from "@/lib/changeRequests/core";

interface Req {
  id: string;
  title: string;
  details: string;
  page: string | null;
  status: ChangeRequestStatus;
  decisionNote: string | null;
  issueUrl: string | null;
  prUrl: string | null;
  createdAt: string;
  author: string;
}

const VARIANT: Record<ChangeRequestStatus, "warning" | "success" | "neutral" | "danger"> = { PROPOSED: "warning", APPROVED: "success", DONE: "neutral", DECLINED: "danger" };

async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** The change-request inbox. Anyone on staff writes requests; a Super Admin approves them and hands the approved ones to Claude Code. */
export default function RequestsInbox() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [prs, setPrs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await call("GET", "/api/admin/requests");
    if (!r.ok) return showToast(String(r.json.error ?? "Could not load the requests."), "error");
    setRequests(r.json.requests as Req[]);
    setIsSuper(r.json.isSuper === true);
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await call("POST", "/api/admin/requests", { title, details, page });
    setBusy(false);
    if (!r.ok) return showToast(String(r.json.error ?? "Could not save that."), "error");
    setTitle("");
    setDetails("");
    setPage("");
    showToast(isSuper ? "Request saved. Approve it below when you are ready." : "Request sent. A Super Admin will look at it.", "success");
    await load();
  }

  async function decide(id: string, status: ChangeRequestStatus) {
    setBusy(true);
    const r = await call("PATCH", `/api/admin/requests/${id}`, { status, note: notes[id] || null, prUrl: prs[id] || null });
    setBusy(false);
    if (!r.ok) return showToast(String(r.json.error ?? "Could not save that."), "error");
    showToast(status === "APPROVED" ? (r.json.issueUrl ? "Approved and sent to GitHub." : "Approved.") : "Saved.", "success");
    await load();
  }

  async function copyBrief() {
    const r = await call("GET", "/api/admin/requests/brief");
    if (!r.ok) return showToast("Could not build the brief.", "error");
    try {
      await navigator.clipboard.writeText(String(r.json.markdown));
      showToast(`Copied ${r.json.count} approved request${r.json.count === 1 ? "" : "s"}. Paste it into Claude Code.`, "success");
    } catch {
      showToast("Copying was blocked. Use Download instead.", "error");
    }
  }

  const approvedCount = (requests ?? []).filter((r) => r.status === "APPROVED").length;

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="requests-inbox">
      <div>
        <h1 className="font-display text-xl font-semibold text-brand-ink">Change requests</h1>
        <p className="mt-1 text-sm text-gray-600">
          Write down a change you want made to the platform. A Super Admin approves it, and only approved requests are handed to Claude Code, which makes the change in a pull request for a person to review.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-3" aria-label="New change request">
          <Input label="What should change?" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Show module numbers in the studio list" />
          <Textarea label="Details" value={details} rows={4} maxLength={4000} onChange={(e) => setDetails(e.target.value)} placeholder="What you see now, what you would like instead, and who it affects." />
          <Input label="Where (optional)" value={page} maxLength={200} onChange={(e) => setPage(e.target.value)} placeholder="A page, e.g. /admin/studio" />
          <Button type="submit" loading={busy} disabled={busy || title.trim().length < 3 || details.trim().length < 10} data-testid="send-request">
            {isSuper ? "Save request" : "Send for approval"}
          </Button>
        </form>
      </Card>

      {isSuper && (
        <Card className="flex flex-wrap items-center gap-2" data-testid="brief-card">
          <p className="min-w-0 flex-1 text-sm text-gray-700">
            <span className="font-semibold text-brand-ink">{approvedCount} approved</span> and waiting for Claude Code.
          </p>
          <Button size="sm" variant="secondary" onClick={() => void copyBrief()} disabled={approvedCount === 0} data-testid="copy-brief">
            Copy for Claude Code
          </Button>
          <a href="/api/admin/requests/brief?download=1" className="text-sm font-medium text-brand-teal hover:underline" data-testid="download-brief">
            Download .md
          </a>
        </Card>
      )}

      <section aria-label="Requests" className="space-y-3">
        {requests === null && <p className="text-sm text-gray-500">Loading…</p>}
        {requests?.length === 0 && <p className="text-sm text-gray-600">No requests yet.</p>}
        {(requests ?? []).map((r) => (
          <Card key={r.id} data-testid="request-card">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-semibold text-brand-ink">{r.title}</h2>
              <Badge variant={VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {r.author} · {new Date(r.createdAt).toLocaleDateString()}
              {r.page ? ` · ${r.page}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.details}</p>
            {r.decisionNote && <p className="mt-2 text-sm text-gray-700"><span className="font-semibold">Agreed:</span> {r.decisionNote}</p>}
            {(r.issueUrl || r.prUrl) && (
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                {r.issueUrl && <a href={r.issueUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">GitHub issue</a>}
                {r.prUrl && <a href={r.prUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">Pull request</a>}
              </p>
            )}
            {isSuper && (r.status === "PROPOSED" || r.status === "APPROVED") && (
              <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
                <Input label={r.status === "APPROVED" ? "Note (optional)" : "What was agreed, or why not (optional)"} value={notes[r.id] ?? ""} maxLength={1000} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                {r.status === "APPROVED" && <Input label="Pull request link (when done)" value={prs[r.id] ?? ""} maxLength={300} onChange={(e) => setPrs((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="https://github.com/…/pull/…" />}
                <div className="flex flex-wrap gap-2">
                  {r.status === "PROPOSED" && (
                    <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "APPROVED")} data-testid="approve-request">
                      Approve
                    </Button>
                  )}
                  {r.status === "APPROVED" && (
                    <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "DONE")} data-testid="done-request">
                      Mark done
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(r.id, "DECLINED")} data-testid="decline-request">
                    Decline
                  </Button>
                </div>
              </div>
            )}
            {isSuper && r.status === "DECLINED" && (
              <div className="mt-3 border-t border-brand-gray pt-3">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(r.id, "PROPOSED")}>
                  Reopen
                </Button>
              </div>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
