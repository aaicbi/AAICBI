"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Waiting { id: string; kind: "game" | "challenge" | "waiting"; opponentName: string; paused: boolean }

/**
 * Anywhere else in the app, a trainee whose game is still on (or who has been challenged) sees a small way back to it.
 * It asks every 20 seconds while the page is visible, and stops for good for anyone who is not a signed-in trainee.
 */
export default function ArenaReturnPill() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<Waiting | null>(null);
  const hidden = path.startsWith("/trainee/arena");
  useEffect(() => {
    if (hidden) return;
    let stop = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/arena/active", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) { stop = true; setM(null); return; }
        const j = await res.json();
        if (!stop) setM(j.match);
      } catch { /* offline: try again later */ }
    };
    const first = setTimeout(check, 2500);
    const id = setInterval(() => { if (!stop) void check(); }, 25_000);
    return () => { stop = true; clearTimeout(first); clearInterval(id); };
  }, [hidden, path]);
  if (hidden || !m || m.kind === "waiting") return null;
  const text = m.kind === "challenge" ? `${m.opponentName} challenged you` : m.paused ? `Your game with ${m.opponentName} is paused` : `Your game with ${m.opponentName} is on`;
  const pos = { bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))", maxWidth: "calc(100vw - 2rem)" };
  async function answer(accept: boolean) {
    if (!m || busy) return;
    setBusy(true);
    const res = await fetch(`/api/arena/matches/${m.id}/${accept ? "accept" : "decline"}`, { method: "POST" }).catch(() => null);
    setBusy(false);
    // The challenge no longer counts on the app icon: refresh the number now instead of at the next 20-second check.
    window.dispatchEvent(new Event("arena-alerts-refresh"));
    if (res?.ok && accept) router.push(`/trainee/arena/match/${m.id}`);
    else setM(null);
  }
  if (m.kind === "challenge") {
    return (
      <div role="alert" className="fixed left-1/2 z-[75] flex w-max -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#d99a34] bg-[#F2B84B] py-2 pl-4 pr-2 text-sm font-bold text-[#2A1D00] shadow-lg" style={pos} data-testid="challenge-pill">
        <span className="min-w-0 leading-tight">⚔️ {text}</span>
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="shrink-0 rounded-full bg-[#0c241f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Accept</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="shrink-0 rounded-full border border-[#2A1D00]/40 px-3 py-1.5 text-xs font-bold text-[#2A1D00]">Decline</button>
      </div>
    );
  }
  return (
    <Link href={`/trainee/arena/match/${m.id}`} className="fixed left-1/2 z-[75] -translate-x-1/2 rounded-full border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-bold text-brand-ink shadow-lg" style={pos}>
      🎮 {text} · Return
    </Link>
  );
}
