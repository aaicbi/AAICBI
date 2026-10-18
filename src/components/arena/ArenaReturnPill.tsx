"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Waiting { id: string; kind: "game" | "challenge" | "waiting"; opponentName: string; paused: boolean }

/**
 * Anywhere else in the app, a trainee whose game is still on (or who has been challenged) sees a small way back to it.
 * It asks every 20 seconds while the page is visible, and stops for good for anyone who is not a signed-in trainee.
 */
export default function ArenaReturnPill() {
  const path = usePathname();
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
    const id = setInterval(() => { if (!stop) void check(); }, 20_000);
    return () => { stop = true; clearTimeout(first); clearInterval(id); };
  }, [hidden, path]);
  if (hidden || !m || m.kind === "waiting") return null;
  const text = m.kind === "challenge" ? `${m.opponentName} challenged you` : m.paused ? `Your game with ${m.opponentName} is paused` : `Your game with ${m.opponentName} is on`;
  return (
    <Link href={`/trainee/arena/match/${m.id}`} className="fixed left-1/2 z-[75] -translate-x-1/2 rounded-full border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-bold text-brand-ink shadow-lg" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))", maxWidth: "calc(100vw - 2rem)" }}>
      🎮 {text} · {m.kind === "challenge" ? "Open" : "Return"}
    </Link>
  );
}
