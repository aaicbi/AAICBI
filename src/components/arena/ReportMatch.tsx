"use client";
import { useState } from "react";
import { REPORT_REASONS } from "@/lib/arena/moderationCore";

/** "Report this match": tell the course's moderators about cheating or abuse. A player reports the other player; a watcher picks who. */
export default function ReportMatch({ matchId, watcherOf }: { matchId: string; watcherOf?: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [who, setWho] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    const res = await fetch(`/api/arena/matches/${matchId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, note: note || null, reportedId: who || null }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(j.error ?? "That didn't send.");
    setMsg("Thank you. A moderator will look at it."); setOpen(false);
  }

  if (msg && !open) return <p className="ar-muted" role="status" data-testid="report-done">{msg}</p>;
  return (
    <div className="ar-report">
      {!open ? <button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => setOpen(true)}>🚩 Report this match</button> : (
        <form className="ar-glass" onSubmit={send} data-testid="report-form" style={{ display: "grid", gap: ".5em", textAlign: "left" }}>
          <strong>What went wrong?</strong>
          {REPORT_REASONS.map((r) => <label key={r.key} className="ar-row" style={{ gap: ".5em" }}><input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} /> {r.label}</label>)}
          {watcherOf && <select className="ar-chatin" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who is this about"><option value="">Who is this about? (optional)</option>{watcherOf.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          <textarea className="ar-chatin" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell the moderator a little more (optional)" aria-label="More detail" style={{ borderRadius: ".8em" }} />
          {msg && <p className="ar-note ar-miss" role="alert">{msg}</p>}
          <div className="ar-row"><button type="submit" className="ar-btn ar-sm" disabled={!reason || busy}>Send report</button><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
