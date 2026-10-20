"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const POS_STORE = "aaicbi-arena-return-pos";
const SIZE = 52;
const EDGE = 8;
interface Pos { left: number; bottom: number }
/** Keeps the button fully on screen. */
function clampPos(p: Pos): Pos {
  return { left: Math.min(Math.max(EDGE, p.left), Math.max(EDGE, window.innerWidth - SIZE - EDGE)), bottom: Math.min(Math.max(EDGE, p.bottom), Math.max(EDGE, window.innerHeight - SIZE - EDGE)) };
}
function readPos(): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS_STORE) ?? "null") as Partial<Pos> | null;
    return p && typeof p.left === "number" && typeof p.bottom === "number" ? clampPos({ left: p.left, bottom: p.bottom }) : null;
  } catch { return null; }
}

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
  // The "game is on" button is a small round one that can be dragged out of the way (or moved with Alt + arrow keys); the spot is remembered.
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; left: number; bottom: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    setPos(readPos());
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const savePos = (p: Pos) => { try { localStorage.setItem(POS_STORE, JSON.stringify(p)); } catch { /* the spot is just not remembered */ } };
  const current = (el: HTMLElement): Pos => { const r = el.getBoundingClientRect(); return { left: r.left, bottom: window.innerHeight - r.bottom }; };
  const onPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const c = current(e.currentTarget);
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, left: c.left, bottom: c.bottom, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    setPos(clampPos({ left: d.left + dx, bottom: d.bottom - dy }));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      savePos(clampPos(current(e.currentTarget)));
    }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = delta[e.key];
    if (!d || !e.altKey) return;
    e.preventDefault();
    const c = current(e.currentTarget);
    const next = clampPos({ left: c.left + d[0], bottom: c.bottom + d[1] });
    setPos(next); savePos(next);
  };
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
  const pillPos = { bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))", maxWidth: "calc(100vw - 2rem)" };
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
      <div role="alert" className="fixed left-1/2 z-[75] flex w-max -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#d99a34] bg-[#F2B84B] py-2 pl-4 pr-2 text-sm font-bold text-[#2A1D00] shadow-lg" style={pillPos} data-testid="challenge-pill">
        <span className="min-w-0 leading-tight">⚔️ {text}</span>
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="shrink-0 rounded-full bg-[#0c241f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Accept</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="shrink-0 rounded-full border border-[#2A1D00]/40 px-3 py-1.5 text-xs font-bold text-[#2A1D00]">Decline</button>
      </div>
    );
  }
  return (
    <Link
      href={`/trainee/arena/match/${m.id}`}
      aria-label={`${text}. Tap to return. Drag to move this button.`}
      title={`${text}. Tap to return, drag to move.`}
      onClick={(e) => { if (suppressClick.current) e.preventDefault(); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      draggable={false}
      className="fixed z-[75] flex touch-none select-none items-center justify-center rounded-full border-2 border-brand-ink bg-brand-gold text-2xl shadow-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-ink"
      style={pos ? { left: pos.left, bottom: pos.bottom, width: SIZE, height: SIZE } : { left: "1rem", bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))", width: SIZE, height: SIZE }}
      data-testid="game-return"
    >
      <span aria-hidden>{m.paused ? "⏸️" : "🎮"}</span>
      {!m.paused && <span aria-hidden className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-brand-gold bg-[#e5484d]" />}
    </Link>
  );
}
