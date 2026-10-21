"use client";
import { useCallback, useEffect, useState } from "react";
import ExpandSelect from "@/components/ui/ExpandSelect";

interface Wallet { enabled: boolean; balance: number; maxTransfer: number; sentToday: number; maxPerDay: number; history: { id: string; points: number; label: string; at: number }[]; mates: { id: string; name: string }[] }

/** Your credits: the balance, a way to send some to a coursemate, and the latest entries. Only shown while the Super Admin has the wallet on. */
export default function ArenaWallet({ courseId, onClose, onChanged, flash }: { courseId: string; onClose: () => void; onChanged: () => void; flash: (m: string) => void }) {
  const [w, setW] = useState<Wallet | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch(`/api/arena/courses/${courseId}/wallet`, { cache: "no-store" }); if (r.ok) setW(await r.json()); }, [courseId]);
  useEffect(() => { void load(); }, [load]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!to || busy) return;
    setBusy(true);
    const r = await fetch(`/api/arena/courses/${courseId}/wallet/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toId: to, amount }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return flash(j.error ?? "That didn't send.");
    flash(`Sent ${j.amount} credit${j.amount === 1 ? "" : "s"}.`);
    void load(); onChanged();
  }
  if (!w) return <div className="ar-card"><p className="ar-muted">Opening your wallet…</p></div>;
  return (
    <div className="ar-card ar-wallet" role="dialog" aria-label="Your credit wallet">
      <div className="ar-row"><b className="ar-grow">⭐ {w.balance} credits</b><button type="button" className="ar-btn ar-ghost ar-sm" onClick={onClose}>Close</button></div>
      {!w.enabled ? <p className="ar-muted">Sending and spending credits opens soon.</p> : (
        <form className="ar-row" onSubmit={send} style={{ flexWrap: "wrap" }}>
          <ExpandSelect tone="dark" compact className="ar-chatin" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send to" style={{ minWidth: 0 }}>
            <option value="">Send to…</option>
            {w.mates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </ExpandSelect>
          <input className="ar-chatin" type="number" min={1} max={w.maxTransfer} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 1)} aria-label="Credits" style={{ maxWidth: "6em", flex: "none" }} />
          <button type="submit" className="ar-btn ar-sm" disabled={!to || busy}>Send</button>
        </form>
      )}
      {w.enabled && <p className="ar-muted" style={{ fontSize: ".8em", margin: 0 }}>Up to {w.maxTransfer} at a time and {w.maxPerDay} a day. Sent today: {w.sentToday}.</p>}
      <div className="ar-lrows" style={{ maxHeight: "9em" }}>
        {w.history.length === 0 && <p className="ar-muted">Win Fastest Fingers questions to earn credits.</p>}
        {w.history.map((h) => <div key={h.id} className="ar-lrow"><span className="ar-nm"><b>{h.label}</b></span><span className={`ar-delta ${h.points >= 0 ? "ar-up" : "ar-down"}`}>{h.points >= 0 ? "+" : "−"}{Math.abs(h.points)}</span></div>)}
      </div>
    </div>
  );
}
