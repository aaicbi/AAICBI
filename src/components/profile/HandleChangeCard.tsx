"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface RequestRow { id: string; currentHandle: string; requestedHandle: string; reason: string; status: string; decisionNote: string | null; createdAt: string }

const STATUS: Record<string, [("success" | "warning" | "danger" | "neutral"), string]> = { PENDING: ["warning", "Waiting for a super admin"], APPROVED: ["success", "Approved"], REJECTED: ["danger", "Not approved"], CANCELLED: ["neutral", "Withdrawn"] };

/**
 * Your /@handle and how to change it. A handle is your public address, so a
 * change is requested with a reason and decided by a super admin. Your old
 * address keeps forwarding to the new one.
 */
export default function HandleChangeCard({ startupId, title = "Your handle" }: { startupId?: string; title?: string } = {}) {
  const [state, setState] = useState<{ handle: string; requests: RequestRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [reason, setReason] = useState("");
  const [avail, setAvail] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const { showToast } = useToast();

  const load = useCallback(() => {
    fetch(`/api/profiles/handle-requests${startupId ? `?startupId=${startupId}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setState(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, [startupId]);
  useEffect(load, [load]);

  function onHandle(v: string) {
    setHandle(v);
    setAvail(null);
    clearTimeout(timer.current);
    if (v.trim().length < 3) return;
    timer.current = setTimeout(async () => {
      const d = await fetch(`/api/profiles/handle?h=${encodeURIComponent(v)}`).then((r) => r.json()).catch(() => null);
      if (!d) return;
      setAvail(d.available ? { ok: true, text: `@${d.handle} is available.` } : { ok: false, text: d.error ?? "That handle is taken." });
    }, 350);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profiles/handle-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, reason, startupId }) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error ?? "Could not send the request.");
    showToast("Request sent. A super admin will decide it.", "success");
    setOpen(false); setHandle(""); setReason(""); setAvail(null);
    load();
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/profiles/handle-requests?id=${id}${startupId ? `&startupId=${startupId}` : ""}`, { method: "DELETE" });
    if (!res.ok) return showToast("Could not withdraw the request.", "error");
    load();
  }

  if (failed) return null;
  if (!state) return null;
  const pending = state.requests.find((r) => r.status === "PENDING");
  const last = state.requests.find((r) => r.status !== "PENDING");

  return (
    <Card className="mt-4" data-testid="handle-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-sm text-brand-ink">
        {startupId ? "The startup's public address is" : "Your public address is"} <a href={`/@${state.handle}`} className="font-semibold text-brand-teal hover:underline">/@{state.handle}</a>. To change it, send a request with your reason. A super admin decides, and your old address keeps forwarding to the new one.
      </p>

      {pending && (
        <div className="mt-3 rounded-xl border border-brand-gray p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="warning">{STATUS.PENDING[1]}</Badge><span className="font-semibold text-brand-ink">@{pending.requestedHandle}</span></div>
          <p className="mt-1 break-words text-gray-700">Your reason: {pending.reason}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => cancel(pending.id)}>Withdraw request</Button>
        </div>
      )}

      {!pending && last && last.status !== "CANCELLED" && (
        <p className="mt-3 text-sm text-gray-700">
          <Badge variant={STATUS[last.status]?.[0] ?? "neutral"}>{STATUS[last.status]?.[1] ?? last.status}</Badge> <span className="ml-1">Your last request, for @{last.requestedHandle}.</span>
          {last.status === "REJECTED" && last.decisionNote && <span className="block mt-1 break-words">Reason given: {last.decisionNote}</span>}
        </p>
      )}

      {!pending && !open && <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>Request a new handle</Button>}

      {!pending && open && (
        <form onSubmit={send} className="mt-3 space-y-3">
          <Input label="The handle you want" value={handle} onChange={(e) => onHandle(e.target.value)} maxLength={31} placeholder="e.g. ada-obi" autoCapitalize="none" autoCorrect="off" hint="3 to 30 letters, numbers, hyphens or underscores." error={avail && !avail.ok ? avail.text : null} />
          {avail?.ok && <p className="text-sm text-brand-teal" role="status">{avail.text}</p>}
          <Textarea label="Why do you want to change it?" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} hint={`${reason.trim().length}/500. At least 10 characters.`} error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
            <Button type="submit" size="sm" loading={busy} disabled={handle.trim().length < 3 || reason.trim().length < 10 || avail?.ok === false}>Send request</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
