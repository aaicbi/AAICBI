"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import LoopFace, { type LoopState } from "@/components/guide/LoopFace";
import GuideSpotlight from "@/components/guide/GuideSpotlight";
import { loadMe, useGuideConfig, useMeForPath } from "@/components/guide/useGuideConfig";
import { contextFor, isHiddenPath, type MeKind } from "@/lib/guide/context";
import { afterShown, BUBBLE_DELAY_MS, BUBBLE_VISIBLE_MS, FRESH_BUBBLE_STATE, nextHint, type BubbleState } from "@/lib/guide/bubble";
import { showSpot } from "@/lib/guide/interactionStore";
import type { VisibilityNotice } from "@/lib/guide/visibilityNotice";
import { ABOVE_BANNER_AND_PAGE_FAB, LOOP_FOOTPRINT_PX, setFloatingOffset } from "@/lib/floatingLayers";

// The chat window (and the matcher it uses) only loads when someone opens it.
const ChatPanel = dynamic(() => import("@/components/guide/ChatPanel"), { ssr: false });

const HINT_STORE = "loop-hints-v1";
const QUIET_STORE = "loop-hints-quiet";
const POS_STORE = "loop-position-v1";
const NOTICE_SNOOZE = "loop-visibility-notice-snoozed";
const SIZE = 56;
const EDGE = 8;

interface Pos { right: number; bottom: number }

/** Keeps Loop fully on screen. */
function clampPos(p: Pos): Pos {
  const maxRight = Math.max(EDGE, window.innerWidth - SIZE - EDGE);
  const maxBottom = Math.max(EDGE, window.innerHeight - SIZE - EDGE);
  return { right: Math.min(Math.max(EDGE, p.right), maxRight), bottom: Math.min(Math.max(EDGE, p.bottom), maxBottom) };
}

function readPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_STORE);
    const p = raw ? (JSON.parse(raw) as Partial<Pos>) : null;
    return p && typeof p.right === "number" && typeof p.bottom === "number" ? clampPos({ right: p.right, bottom: p.bottom }) : null;
  } catch {
    return null;
  }
}

function readHints(): BubbleState {
  try {
    const raw = sessionStorage.getItem(HINT_STORE);
    const parsed = raw ? (JSON.parse(raw) as Partial<BubbleState>) : {};
    return {
      shownCount: typeof parsed.shownCount === "number" ? parsed.shownCount : 0,
      shownKeys: Array.isArray(parsed.shownKeys) ? parsed.shownKeys.filter((k): k is string => typeof k === "string") : [],
      quiet: localStorage.getItem(QUIET_STORE) === "1",
    };
  } catch {
    return FRESH_BUBBLE_STATE;
  }
}

function typingSomewhere(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
}

/**
 * Loop, the ecosystem guide: a small round button on every page, a short
 * comic-style hint now and then, and a chat window that opens above it.
 * Mounted once in the root layout. It shows nothing until the switch has
 * been read, nothing when SUPER_ADMIN has switched it off, and nothing
 * during an exam, assessment or assignment. The page-help button it
 * replaces comes back whenever Loop is not showing.
 */
export default function LoopGuide() {
  const pathname = usePathname() ?? "/";
  const state = useGuideConfig();
  const earlyMe = useMeForPath(pathname);
  const visible = state.status === "ready" && state.config.enabled && !isHiddenPath(pathname, earlyMe);
  const config = state.status === "ready" ? state.config : null;

  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<LoopState>("minimized");
  const [hint, setHint] = useState<string | null>(null);
  const router = useRouter();
  // Told once, per account, that the profile is public and how to make it private.
  const [notice, setNotice] = useState<VisibilityNotice | null>(null);
  const [chatMe, setMe] = useState<MeKind | null>(null);
  const me = earlyMe ?? chatMe;
  const meLoaded = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const hints = useRef<BubbleState>(FRESH_BUBBLE_STATE);

  // Loop can be dragged out of the way (or moved with the arrow keys) so it never covers a button; the spot is remembered.
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; right: number; bottom: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    setPos(readPos());
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const savePos = (p: Pos) => {
    try { localStorage.setItem(POS_STORE, JSON.stringify(p)); } catch { /* the spot is just not remembered */ }
  };
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    setHint(null);
    setPos(clampPos({ right: d.right - dx, bottom: d.bottom - dy }));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      const r = e.currentTarget.getBoundingClientRect();
      savePos(clampPos({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom }));
    }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const delta: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = delta[e.key];
    if (!d || !e.altKey) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const next = clampPos({ right: window.innerWidth - r.right + d[0], bottom: window.innerHeight - r.bottom + d[1] });
    setPos(next);
    savePos(next);
  };
  const resetPos = () => { setPos(null); setOpen(false); setFace("minimized"); try { localStorage.removeItem(POS_STORE); } catch { /* nothing to forget */ } };

  const ctx = useMemo(() => contextFor(pathname, config?.switches ?? { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true }, me), [pathname, config, me]);

  // Tell the other floating layers where Loop is.
  useEffect(() => {
    if (!visible) return;
    setFloatingOffset("loop", LOOP_FOOTPRINT_PX);
    return () => setFloatingOffset("loop", 0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    try {
      if (sessionStorage.getItem(NOTICE_SNOOZE) === "1") return;
    } catch {
      /* private mode: it may show again after a reload, which is fine */
    }
    let live = true;
    const t = window.setTimeout(() => {
      loadMe().then((kind) => {
        if (!live || (kind !== "trainee" && kind !== "employer")) return;
        fetch("/api/guide/visibility-notice", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((n) => { if (live && n?.show) setNotice(n as VisibilityNotice); })
          .catch(() => undefined);
      });
    }, 2500);
    return () => { live = false; window.clearTimeout(t); };
  }, [visible]);

  const ackNotice = useCallback(() => {
    fetch("/api/guide/visibility-notice", { method: "POST" }).catch(() => undefined);
    setNotice(null);
  }, []);
  const snoozeNotice = useCallback(() => {
    try { sessionStorage.setItem(NOTICE_SNOOZE, "1"); } catch { /* nothing to remember it in */ }
    setNotice(null);
  }, []);
  const showHowToHide = useCallback((n: VisibilityNotice) => {
    ackNotice();
    showSpot({ target: n.target, text: "Choose who can see your profile here." });
    if (pathname !== n.href) router.push(n.href);
  }, [ackNotice, pathname, router]);

  const openPanel = useCallback(() => {
    setHint(null);
    setOpen(true);
    if (!meLoaded.current) {
      meLoaded.current = true;
      loadMe().then(setMe);
    }
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setFace("minimized");
    button.current?.focus();
  }, []);

  // An unprompted hint: rare, short, and never while the chat is open or someone is typing.
  useEffect(() => {
    if (!visible || open) return;
    hints.current = readHints();
    const timers: number[] = [];
    const wave = BUBBLE_DELAY_MS - 1500;
    if (nextHint(ctx, hints.current)) {
      timers.push(window.setTimeout(() => setFace("attention"), wave));
      timers.push(
        window.setTimeout(() => {
          const message = nextHint(ctx, hints.current);
          if (!message || typingSomewhere()) {
            setFace("minimized");
            return;
          }
          hints.current = afterShown(hints.current, ctx.key);
          try {
            sessionStorage.setItem(HINT_STORE, JSON.stringify(hints.current));
          } catch {
            /* private mode: hints may repeat after a reload, which is fine */
          }
          setHint(message);
          setFace("speaking");
          timers.push(
            window.setTimeout(() => {
              setHint(null);
              setFace("minimized");
            }, BUBBLE_VISIBLE_MS),
          );
        }, BUBBLE_DELAY_MS),
      );
    }
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      setHint(null);
      setFace("minimized");
    };
  }, [visible, open, ctx.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !config) return null;

  return (
    <div className="print:hidden">
      <GuideSpotlight />
      {open && <ChatPanel pathname={pathname} config={config} me={me} ctx={ctx} onClose={closePanel} onState={setFace} onResetPosition={pos ? resetPos : undefined} />}

      {notice && !open && (
        <div role="group" aria-label="A note from Loop about your profile" className="fixed right-4 z-40 w-[18rem] max-w-[calc(100vw-2rem)] animate-[loop-bubble-in_0.2s_ease-out] sm:right-6" style={pos ? { right: Math.min(pos.right, Math.max(EDGE, window.innerWidth - 288 - EDGE)), bottom: pos.bottom + 72 > window.innerHeight - 260 ? Math.max(EDGE, pos.bottom - 230) : pos.bottom + 72 } : { bottom: `calc(${ABOVE_BANNER_AND_PAGE_FAB} + 4.5rem)` }}>
          <div className="relative rounded-2xl border-2 border-brand-ink bg-brand-surface py-3 pl-3.5 pr-9 shadow-[3px_3px_0_0_rgb(var(--brand-ink))]">
            <p className="text-sm font-semibold leading-snug text-brand-ink">{notice.text}</p>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <button type="button" onClick={() => showHowToHide(notice)} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">{notice.showLabel}</button>
              <button type="button" onClick={ackNotice} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-teal px-3 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">{notice.keepLabel}</button>
            </div>
            <button type="button" onClick={snoozeNotice} aria-label="Remind me later" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <Icon icon={X} size="sm" />
            </button>
            <span aria-hidden="true" className="absolute -bottom-[9px] right-7 h-4 w-4 rotate-45 border-b-2 border-r-2 border-brand-ink bg-brand-surface" />
          </div>
        </div>
      )}

      {hint && !open && !notice && (
        <div role="group" aria-label="A hint from Loop" className="fixed right-4 z-40 w-[15.5rem] max-w-[calc(100vw-2rem)] animate-[loop-bubble-in_0.2s_ease-out] sm:right-6" style={pos ? { right: Math.min(pos.right, Math.max(EDGE, window.innerWidth - 248 - EDGE)), bottom: pos.bottom + 72 > window.innerHeight - 140 ? Math.max(EDGE, pos.bottom - 120) : pos.bottom + 72 } : { bottom: `calc(${ABOVE_BANNER_AND_PAGE_FAB} + 4.5rem)` }}>
          <div className="relative rounded-2xl border-2 border-brand-ink bg-brand-surface py-2.5 pl-3.5 pr-9 shadow-[3px_3px_0_0_rgb(var(--brand-ink))]">
            <button type="button" onClick={openPanel} className="text-left text-sm font-semibold leading-snug text-brand-ink focus:outline-none focus-visible:underline">
              {hint}
            </button>
            <button type="button" onClick={() => setHint(null)} aria-label="Dismiss this hint" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <Icon icon={X} size="sm" />
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(QUIET_STORE, "1");
                } catch {
                  /* nothing to remember it in */
                }
                setHint(null);
              }}
              className="mt-1 block text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              Stop these hints
            </button>
            <span aria-hidden="true" className="absolute -bottom-[9px] right-7 h-4 w-4 rotate-45 border-b-2 border-r-2 border-brand-ink bg-brand-surface" />
          </div>
        </div>
      )}

      <button
        ref={button}
        type="button"
        onClick={() => { if (suppressClick.current) return; open ? closePanel() : openPanel(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        title="Drag me out of the way. Open me and choose Put Loop back to return me."
        aria-label={open ? "Minimize Loop" : "Ask Loop, the ecosystem guide. Drag to move; Alt and arrow keys also move it."}
        aria-expanded={open}
        aria-controls={open ? "loop-panel" : undefined}
        className="fixed right-4 z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-brand-surface shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 sm:right-6"
        style={pos ? { right: pos.right, bottom: pos.bottom } : { bottom: ABOVE_BANNER_AND_PAGE_FAB }}
      >
        <LoopFace size={56} state={open ? "idle" : face} />
      </button>
    </div>
  );
}
