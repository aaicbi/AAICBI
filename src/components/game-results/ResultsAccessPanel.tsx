"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  allowed: boolean;
}

/**
 * Super Admin only: who may open the Game results table. One switch shares the table with staff at all; then each person is
 * switched on or off, with a search box to find them. Staff who are switched on see only players in their own courses.
 */
export default function ResultsAccessPanel() {
  const { showToast } = useToast();
  const [shared, setShared] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/game-results/access");
    if (!res.ok) return;
    const j = await res.json();
    setShared(!!j.shared);
    setPeople(j.people ?? []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function put(body: Record<string, unknown>, key: string, message: string) {
    setBusy(key);
    const res = await fetch("/api/admin/game-results/access", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) return showToast((await res.json().catch(() => ({}))).error ?? "That didn't work.", "error");
    showToast(message, "success");
    await load();
  }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? people.filter((p) => p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t)) : people;
  }, [people, q]);
  const allowedCount = people.filter((p) => p.allowed).length;

  return (
    <Card data-testid="results-access">
      <h2 className="font-display text-lg font-semibold text-brand-ink">Who can see this table</h2>
      <p className="mt-1 text-sm text-gray-700">You always can. Switch sharing on, then choose the staff who may also open it. They see only the players in their own courses.</p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-brand-mint/60 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-ink">Share the table with staff</p>
          <p className="text-xs text-gray-700">{shared ? `On. ${allowedCount} ${allowedCount === 1 ? "person is" : "people are"} switched on below.` : "Off. Only Super Admins can see player results."}</p>
        </div>
        <Toggle checked={shared} disabled={!loaded || busy === "shared"} onChange={(next) => void put({ shared: next }, "shared", next ? "Shared with the staff you choose." : "Only Super Admins can see it now.")} label="Share the game results table with staff" />
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="min-h-[44px] w-full rounded-full border border-brand-gray bg-brand-surface pl-9 pr-3 text-sm text-brand-ink" />
      </div>
      <ul className={`mt-3 divide-y divide-brand-gray rounded-2xl border border-brand-gray ${shared ? "" : "opacity-60"}`} aria-label="Staff">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5" data-testid="results-person">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-ink">{p.name}</p>
              <p className="truncate text-xs text-gray-600">{p.email} · {p.role === "ADMIN" ? "Admin" : "Instructor"}</p>
            </div>
            <Toggle checked={p.allowed} disabled={busy === p.id} onChange={(next) => void put({ userId: p.id, allowed: next }, p.id, next ? `${p.name} can open the table.` : `${p.name} can no longer open it.`)} label={`${p.name} may see the game results`} />
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-600">{loaded ? "No staff match." : "Loading…"}</li>}
      </ul>
      {!shared && allowedCount > 0 && <p className="mt-2 text-xs text-gray-600">These switches take effect once sharing is on.</p>}
    </Card>
  );
}
