"use client";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { RegistrationRow } from "@/lib/events/eventsRegistration";

interface Data { rows: RegistrationRow[]; capacity: number | null; confirmed: number; pending: number; attended: number }
const variant = (s: string) => (s === "CONFIRMED" ? "success" : s === "PENDING" ? "warning" : s === "DECLINED" ? "danger" : "neutral") as "success" | "warning" | "danger" | "neutral";

/**
 * Who registered, who waits for approval, and the attendance register. Attendance is marked by a person after the event starts: opening a
 * Google Meet, Zoom or Teams link is never counted as attendance, because the platform cannot see what happens inside those services.
 */
export default function RegistrationsPanel({ apiBase, eventId, canManage, canExport, started }: { apiBase: string; eventId: string; canManage: boolean; canExport: boolean; started: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decline, setDecline] = useState<RegistrationRow | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const { showToast } = useToast();
  const load = useCallback(async () => {
    setError(null);
    const r = await fetch(`${apiBase}/${eventId}/registrations`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Could not load the participants."); else setData(j);
  }, [apiBase, eventId]);
  useEffect(() => { void load(); }, [load]);

  async function act(registrationId: string, op: string, why?: string) {
    const r = await fetch(`${apiBase}/${eventId}/registrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, op, reason: why }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { if (op === "decline") setProblem(j.error ?? "That did not work."); else showToast(j.error ?? "That did not work.", "error"); return false; }
    await load();
    return true;
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;
  return (
    <div className="space-y-3" data-testid="registrations-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-700"><b>{data.confirmed}</b> confirmed{data.capacity !== null ? ` of ${data.capacity}` : ""} · <b>{data.pending}</b> waiting · <b>{data.attended}</b> marked present</p>
        {canExport && <a href={`${apiBase}/${eventId}/export`} className="inline-flex min-h-[44px] items-center rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint">Download participants (CSV)</a>}
      </div>
      {!started && canManage && <p className="rounded-lg bg-brand-mint/40 px-3 py-2 text-xs text-gray-700">You can mark who attended once the event has started.</p>}
      {data.rows.length === 0 ? <p className="rounded-xl border border-dashed border-brand-gray p-6 text-center text-sm text-gray-600">Nobody has registered yet.</p> : (
        <ul className="divide-y divide-brand-gray rounded-xl border border-brand-gray bg-brand-surface">
          {data.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-ink">{r.name}</p>
                <p className="text-xs text-gray-600">{r.kind}{r.attendanceMode ? ` · ${r.attendanceMode.toLowerCase()}` : ""} · registered {new Date(r.registeredAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={variant(r.status)}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                {canManage && r.status === "PENDING" && <><Button size="sm" onClick={() => void act(r.id, "confirm")}>Confirm</Button><Button size="sm" variant="secondary" onClick={() => { setDecline(r); setReason(""); setProblem(null); }}>Decline</Button></>}
                {canManage && r.status === "CONFIRMED" && started && (
                  <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={r.attended} onChange={(e) => void act(r.id, e.target.checked ? "attended" : "not_attended")} /> Present</label>
                )}
                {canManage && r.status === "DECLINED" && <Button size="sm" variant="secondary" onClick={() => void act(r.id, "confirm")}>Confirm instead</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!decline} onClose={() => setDecline(null)} title="Decline this registration">
        <div className="space-y-3">
          <Textarea label="Reason (the person sees this)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} required />
          {problem && <p role="alert" className="text-sm text-brand-rose">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDecline(null)}>Back</Button><Button variant="danger" onClick={async () => { if (decline && (await act(decline.id, "decline", reason))) setDecline(null); }}>Decline</Button></div>
        </div>
      </Modal>
    </div>
  );
}
