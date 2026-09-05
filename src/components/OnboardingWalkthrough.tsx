"use client";
import { useState } from "react";

export interface OnboardingStep {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

/**
 * A self-contained, illustrated modal sequence — not a spotlight tour
 * pointing at live page elements. A deliberate trade-off, not a
 * shortcut: spotlight tours are fragile (repositioning on scroll,
 * breaking on mobile, needing a fix every time a layout changes), and
 * this app's own research-backed direction favors calm, restrained
 * design over anything flashier. Content-agnostic on purpose — takes
 * `steps` as a prop so the exact same mechanics serve both the
 * trainee and employer walkthroughs, which need genuinely different
 * content, not a duplicated component.
 *
 * `onComplete` fires identically whether the person finishes every
 * step or clicks "Skip" partway through — from the caller's side,
 * both mean the same real thing: this walkthrough is done, mark it
 * seen. There's no separate "skipped" state to persist, since nothing
 * downstream needs to distinguish "watched all five steps" from
 * "watched two and skipped the rest."
 */
export default function OnboardingWalkthrough({
  steps,
  onComplete,
}: {
  steps: OnboardingStep[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-gray bg-brand-surface p-8 text-center shadow-xl animate-[modal-in_0.15s_ease-out]">
        <button
          onClick={onComplete}
          className="float-right -mt-2 -mr-2 text-xs font-semibold text-gray-400 hover:text-gray-600"
        >
          Skip
        </button>

        {step.icon && <div className="mx-auto mb-4 h-20 w-20 text-brand-teal">{step.icon}</div>}
        <p className="font-display text-xl font-semibold text-brand-ink">{step.title}</p>
        <p className="mt-2 text-sm text-gray-600">{step.description}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-brand-teal" : "w-1.5 bg-brand-gray"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="text-xs font-semibold text-gray-500 disabled:opacity-0"
          >
            ← Back
          </button>
          <button
            onClick={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
            className="rounded-lg bg-brand-teal px-5 py-2 text-sm font-semibold text-white hover:bg-brand-tealDeep"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
