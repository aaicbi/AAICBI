"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import LoopFace, { type LoopState } from "@/components/guide/LoopFace";
import GuideSpotlight from "@/components/guide/GuideSpotlight";
import { loadMe, useGuideConfig, useMeForPath } from "@/components/guide/useGuideConfig";
import { contextFor, isHiddenPath, type MeKind } from "@/lib/guide/context";
import { afterShown, BUBBLE_DELAY_MS, BUBBLE_VISIBLE_MS, FRESH_BUBBLE_STATE, nextHint, type BubbleState } from "@/lib/guide/bubble";
import { ABOVE_BANNER_AND_PAGE_FAB, LOOP_FOOTPRINT_PX, setFloatingOffset } from "@/lib/floatingLayers";

// The chat window (and the matcher it uses) only loads when someone opens it.
const ChatPanel = dynamic(() => import("@/components/guide/ChatPanel"), { ssr: false });

const HINT_STORE = "loop-hints-v1";
const QUIET_STORE = "loop-hints-quiet";

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
  const [chatMe, setMe] = useState<MeKind | null>(null);
  const me = earlyMe ?? chatMe;
  const meLoaded = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const hints = useRef<BubbleState>(FRESH_BUBBLE_STATE);

  const ctx = useMemo(() => contextFor(pathname, config?.switches ?? { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true }, me), [pathname, config, me]);

  // Tell the other floating layers where Loop is.
  useEffect(() => {
    if (!visible) return;
    setFloatingOffset("loop", LOOP_FOOTPRINT_PX);
    return () => setFloatingOffset("loop", 0);
  }, [visible]);

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
      {open && <ChatPanel pathname={pathname} config={config} me={me} ctx={ctx} onClose={closePanel} onState={setFace} />}

      {hint && !open && (
        <div role="group" aria-label="A hint from Loop" className="fixed right-4 z-40 w-[15.5rem] max-w-[calc(100vw-2rem)] animate-[loop-bubble-in_0.2s_ease-out] sm:right-6" style={{ bottom: `calc(${ABOVE_BANNER_AND_PAGE_FAB} + 4.5rem)` }}>
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
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={open ? "Minimize Loop" : "Ask Loop, the ecosystem guide"}
        aria-expanded={open}
        aria-controls={open ? "loop-panel" : undefined}
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-surface shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 sm:right-6"
        style={{ bottom: ABOVE_BANNER_AND_PAGE_FAB }}
      >
        <LoopFace size={56} state={open ? "idle" : face} />
      </button>
    </div>
  );
}
