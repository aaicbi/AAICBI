"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { Marked } from "@/components/guide/PlaybookCard";
import { getPlaybook } from "@/lib/guide/playbooks";
import { cardPlacement, completes, onStepPage, spotExpired, SPOT_SHOWN_MS, targetSelector, type CompleteOn, type DomEvent } from "@/lib/guide/interaction";
import { clearFinished, clearSpot, getState, nextStep, previousStep, SERVER_STATE, stopTour, subscribe } from "@/lib/guide/interactionStore";
import { ABOVE_BANNER_AND_PAGE_FAB } from "@/lib/floatingLayers";

const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function isShown(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

function findVisible(id: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(targetSelector(id)))) if (isShown(el)) return el;
  return null;
}

const isField = (el: Element) => ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);

/** The person is typing somewhere else (outside Loop): do not pull the page away from them. */
function typingElsewhere(el: HTMLElement | null): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a || a === el || a.closest("#loop-panel") || a.closest("[data-guide-card]")) return false;
  return isField(a) || a.isContentEditable;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

const PAD = 4;

/**
 * Draws Loop's pointing: a soft animated beam around the control a guide
 * step or a "Show me" is about, scrolls it into view, focuses a field when
 * that is welcome, and notices when the person actually uses it so the guide
 * moves on by itself. It also shows the small card that says what to do.
 * It looks controls up by their data-guide-target id only. Mounted once, with
 * Loop; invisible when nothing has been asked.
 */
export default function GuideSpotlight() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { tour, spot, finished } = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);

  const book = tour ? getPlaybook(tour.id) : undefined;
  const step = book && tour ? book.steps[Math.min(tour.step, book.steps.length - 1)] : undefined;
  const target = step ? step.target : spot?.target;
  const completeOn: CompleteOn = step ? step.completeOn ?? (step.target ? "click" : "none") : spot?.completeOn ?? "click";
  const page = step?.page;
  const onPage = onStepPage(page, pathname);
  const total = book?.steps.length ?? 0;
  const key = `${tour ? tour.id + ":" + tour.step : "spot:" + (spot?.at ?? 0)}:${target ?? ""}`;

  const [el, setEl] = useState<HTMLElement | null>(null);
  const [viaMore, setViaMore] = useState(false);
  const [missing, setMissing] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const cardRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<() => void>(() => {});

  // Move on: the person did the step.
  doneRef.current = () => {
    if (tour && book) nextStep(total, book.title);
    else clearSpot();
  };

  // Find the control, and keep looking: a menu or sheet may open later and bring the real one into view.
  useEffect(() => {
    setEl(null);
    setViaMore(false);
    setMissing(false);
    setBox(null);
    if (!target || !onPage) return;
    const started = Date.now();
    const look = () => {
      let found = findVisible(target);
      let more = false;
      if (!found && target.startsWith("nav:")) {
        found = findVisible("more");
        more = !!found;
      }
      setEl((cur) => (cur === found ? cur : found));
      setViaMore(more);
      setMissing(!found && Date.now() - started > 5000);
    };
    look();
    const id = window.setInterval(look, 300);
    return () => window.clearInterval(id);
  }, [key, onPage, target]);

  // Bring it into view and, on a computer, into focus. Never while the person is typing somewhere else.
  useEffect(() => {
    if (!el || typingElsewhere(el)) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersLessMotion() ? "auto" : "smooth" });
    if (isField(el) && completeOn === "input" && !isTouch()) el.focus({ preventScroll: true });
  }, [el, completeOn]);

  // Follow the control while it moves (scroll, resize, layout change).
  useEffect(() => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (!el.isConnected) {
        setEl(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
      setBox((b) => (b && b.top === r.top - PAD && b.left === r.left - PAD && b.width === r.width + PAD * 2 && b.height === r.height + PAD * 2 ? b : { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, radius: radius + PAD }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [el]);

  // Notice the person doing it.
  useEffect(() => {
    // When More is highlighted only as a stand-in, opening it is not the step: wait for the real control.
    if (!el || viaMore || completeOn === "none") return;
    let idle = 0;
    const inside = (n: EventTarget | null) => n instanceof Node && el.contains(n);
    const finish = (delay: number) => window.setTimeout(() => doneRef.current(), delay);
    const on = (type: DomEvent) => (e: Event) => {
      if (!completes(type, completeOn)) return;
      if (type === "submit") {
        const form = e.target as HTMLFormElement;
        if (!(inside(e.target) || (form.contains && form.contains(el)))) return;
        finish(150);
        return;
      }
      if (!inside(e.target)) return;
      if (type === "click") {
        finish(180);
        return;
      }
      const value = (e.target as HTMLInputElement).value;
      window.clearTimeout(idle);
      if (type === "change") {
        if (value && value.trim()) finish(100);
      } else if (value && value.trim()) {
        // Typing: move on once they pause, not on the first letter.
        idle = window.setTimeout(() => doneRef.current(), 1800);
      }
    };
    const handlers: Array<[string, (e: Event) => void]> = [
      ["click", on("click")],
      ["change", on("change")],
      ["input", on("input")],
      ["submit", on("submit")],
    ];
    for (const [t, h] of handlers) document.addEventListener(t, h, true);
    return () => {
      window.clearTimeout(idle);
      for (const [t, h] of handlers) document.removeEventListener(t, h, true);
    };
  }, [el, completeOn, viaMore]);

  // A spot-light is brief: it goes after a while, or if the control never appears.
  useEffect(() => {
    if (tour || !spot) return;
    const wait = window.setInterval(() => {
      if (spotExpired(spot, Date.now(), !!el)) clearSpot();
    }, 1000);
    const shown = el ? window.setTimeout(clearSpot, SPOT_SHOWN_MS) : 0;
    return () => {
      window.clearInterval(wait);
      if (shown) window.clearTimeout(shown);
    };
  }, [tour, spot, el]);

  // Keep the card clear of the control: measure where it really is, and move it to the other side once if it would touch.
  const flipped = useRef(0);
  useEffect(() => {
    flipped.current = 0;
    setPlacement("bottom");
  }, [key]);
  useEffect(() => {
    if (!box || !cardRef.current || flipped.current >= 2) return;
    const c = cardRef.current.getBoundingClientRect();
    const next = cardPlacement(placement, { top: c.top, bottom: c.bottom, left: c.left, right: c.right }, { top: box.top, bottom: box.top + box.height, left: box.left, right: box.left + box.width });
    if (next !== placement) {
      flipped.current += 1;
      setPlacement(next);
    }
  }, [box, placement, missing, onPage]);

  // Escape ends a guide or a spot-light.
  useEffect(() => {
    if (!tour && !spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(document.activeElement && isField(document.activeElement))) {
        if (tour) stopTour();
        else clearSpot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, spot]);

  // "All done" fades by itself.
  useEffect(() => {
    if (!finished) return;
    const t = window.setTimeout(clearFinished, 4500);
    return () => window.clearTimeout(t);
  }, [finished]);

  const takeMeThere = useCallback(() => {
    if (page) router.push(page);
  }, [page, router]);

  const cardStyle: React.CSSProperties = placement === "top" ? { top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" } : { bottom: `calc(${ABOVE_BANNER_AND_PAGE_FAB} + 4.5rem)` };
  const cardClass = "fixed right-4 z-[86] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-brand-teal bg-brand-surface p-3.5 text-brand-ink shadow-2xl animate-[modal-in_0.15s_ease-out] print:hidden sm:right-6";

  if (finished && !tour && !spot) {
    return (
      <div data-guide-card role="status" className={cardClass} style={{ bottom: `calc(${ABOVE_BANNER_AND_PAGE_FAB} + 4.5rem)` }}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon icon={Check} size="md" className="text-brand-teal" /> You&apos;ve finished: {finished}
        </p>
      </div>
    );
  }
  if (!target && !tour) return null;

  const beam = el && box && onPage ? <div aria-hidden="true" className="guide-beam" style={{ top: box.top, left: box.left, width: box.width, height: box.height, ["--guide-radius" as string]: `${box.radius}px` }} /> : null;

  if (tour && book && step) {
    const waiting = !!target && completeOn !== "none";
    return (
      <>
        {beam}
        <div ref={cardRef} data-guide-card role="status" aria-live="polite" aria-label={`Guide: ${book.title}`} className={cardClass} style={cardStyle}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-brand-teal">
              {book.title} · Step {tour.step + 1} of {total}
            </p>
            <button type="button" onClick={stopTour} aria-label="End this guide" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <div role="progressbar" aria-label="Guide progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={tour.step + 1} className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-gray">
            <div className="h-full bg-brand-teal transition-[width]" style={{ width: `${((tour.step + 1) / total) * 100}%` }} />
          </div>
          <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm">
            <Marked text={step.text} />
          </p>
          {!onPage && page && (
            <button type="button" onClick={takeMeThere} className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon icon={MapPin} size="sm" /> Take me there
              </span>
              <Icon icon={ArrowRight} size="sm" />
            </button>
          )}
          {onPage && viaMore && (
            <p className="mt-2 rounded-lg bg-brand-mint px-2.5 py-1.5 text-xs">
              It&apos;s in the <span className="font-semibold">More</span> menu. Tap it, then look for the highlighted item.
            </p>
          )}
          {onPage && target && missing && !viaMore && (
            <p className="mt-2 rounded-lg bg-brand-mint px-2.5 py-1.5 text-xs">I can&apos;t see that on this screen yet. It may be further down, or on another page. You can skip this step.</p>
          )}
          {waiting && onPage && el && !viaMore && <p className="mt-2 text-xs text-gray-600">I&apos;ll move on when you do it.</p>}
          {step.tip && (
            <p className="mt-2 rounded-lg bg-brand-mint px-2.5 py-1.5 text-xs">
              <span className="font-semibold">Good to know: </span>
              <Marked text={step.tip} />
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={previousStep} disabled={tour.step === 0} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:cursor-not-allowed disabled:text-gray-400">
              <Icon icon={ArrowLeft} size="sm" /> Back
            </button>
            <button type="button" onClick={() => nextStep(total, book.title)} className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${waiting ? "text-brand-teal hover:underline" : "bg-brand-teal text-brand-onAccent hover:bg-brand-tealDeep"}`}>
              {tour.step + 1 === total ? (
                <>
                  <Icon icon={Check} size="sm" /> Finish
                </>
              ) : waiting ? (
                "Skip step"
              ) : (
                <>
                  Next <Icon icon={ArrowRight} size="sm" />
                </>
              )}
            </button>
          </div>
        </div>
      </>
    );
  }

  // A single "Show me".
  return (
    <>
      {beam}
      <div ref={cardRef} data-guide-card role="status" aria-live="polite" className={cardClass} style={cardStyle}>
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold">{missing && !viaMore ? "I can't see that on this screen." : viaMore ? "It's in the More menu: tap it, then look for the highlighted item." : spot?.text || "Here it is."}</p>
          <button type="button" onClick={clearSpot} className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
