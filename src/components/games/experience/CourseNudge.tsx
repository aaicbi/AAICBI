"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LoopFace from "@/components/guide/LoopFace";

/**
 * Loop's pop-up for someone who has not registered for the course and did not pass a round: kind, never scolding, and it points at the course. A bottom sheet on a phone and a
 * centred card on a larger screen, it slides in, Loop bounces and the button pulses (all of it off under reduced motion). Escape,
 * the backdrop and "Keep playing" close it; focus moves into it and back out.
 */
export default function CourseNudge({ courseTitle, courseHref, onClose }: { courseTitle: string; courseHref: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);

  useEffect(() => {
    previous.current = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (previous.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" data-testid="course-nudge">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="gx-fade absolute inset-0 bg-brand-ink/50" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-nudge-title"
        tabIndex={-1}
        className="gx-sheet relative w-full max-w-md rounded-t-3xl bg-card-gradient p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <span className="gx-bounce shrink-0"><LoopFace state="speaking" size={72} /></span>
          <div className="min-w-0">
            <h2 id="course-nudge-title" className="font-display text-lg font-bold text-brand-ink">That round was tricky, and that&apos;s okay!</h2>
            <p className="mt-1 text-sm text-brand-ink">
              <strong>{courseTitle}</strong> teaches exactly this, one clear step at a time, with every game, your progress and a certificate at the end. Register now and turn those misses into wins.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href={courseHref} data-testid="nudge-register" className="gx-pulse inline-flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover">
            Register now <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" onClick={onClose} data-testid="nudge-close" className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint">
            Keep playing
          </button>
        </div>
      </div>
    </div>
  );
}
