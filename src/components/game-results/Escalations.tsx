"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";

interface Item { id: string; organization: string; course: string | null; trainee: string | null; reason: string; by: string | null; at: number; resolved: boolean }

/** Incidents training organizations passed up to AAICBI. Closing one needs a note and "Incidents and escalations: Manage". */
export default function Escalations({ canClose }: { canClose: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/game-ops/escalations", { cache: "no-store" });
    setItems(r.ok ? ((await r.json()) as { items: Item[] }).items : []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function close(id: string) {
    setMsg(null);
    const r = await fetch("/api/admin/game-ops/escalations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, note }) });
    if (!r.ok) { setMsg(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "That could not be saved."); return; }
    setOpen(null); setNote(""); await load();
  }
  if (!items) return null;
  const pending = items.filter((i) => !i.resolved);
  return (
    <section data-testid="escalations">
      <h2 className="text-lg font-semibold text-brand-ink">Escalated by organizations</h2>
      {pending.length === 0 ? <p className="mt-1 text-sm text-gray-600">Nothing waiting.</p> : (
        <ul className="mt-2 space-y-2">
          {pending.map((i) => (
            <li key={i.id}>
              <Card>
                <p className="text-sm font-medium text-brand-ink">{i.organization}{i.course ? ` · ${i.course}` : ""}{i.trainee ? ` · ${i.trainee}` : ""}</p>
                <p className="mt-1 text-sm text-gray-700">{i.reason}</p>
                <p className="mt-1 text-xs text-gray-500">Sent by {i.by ?? "an organization admin"}, {new Date(i.at).toLocaleString()}</p>
                {canClose && (open === i.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was decided?" rows={2} />
                    {msg && <p className="text-sm text-red-700">{msg}</p>}
                    <div className="flex gap-2"><Button onClick={() => close(i.id)}>Close incident</Button><Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button></div>
                  </div>
                ) : <div className="mt-2"><Button variant="secondary" onClick={() => { setOpen(i.id); setNote(""); setMsg(null); }}>Close with a note</Button></div>)}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
