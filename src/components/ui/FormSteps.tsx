"use client";
import { Children, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { nextStep, previousStep, stepProgress } from "@/lib/forms/inputAttrs";

/**
 * A long form shown one part at a time on a phone, and all at once on a
 * larger screen. Each child is one part (a card or a group of fields). On a
 * phone a header shows "Step 2 of 4" with its name, Back and Next move
 * between parts, Next checks that the part's required fields are filled
 * first, and Enter moves forward instead of submitting half a form. The
 * form's own submit button(s), passed as `footer`, appear on the last part.
 * Nothing about the form's data or submission changes: every field is still
 * in the page, only the parts not being shown are hidden on small screens.
 */
export default function FormSteps({ labels, children, footer, className = "space-y-4" }: { labels: string[]; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  const parts = Children.toArray(children);
  const [step, setStep] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const p = stepProgress(step, parts.length);

  function go(to: number) {
    setStep(to);
    // Back to the top of the form so the new part starts in view.
    refs.current[to]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function next() {
    const fields = refs.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? [];
    for (const f of Array.from(fields)) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return;
      }
    }
    go(nextStep(step, parts.length));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (e.key !== "Enter" || p.isLast || t.tagName !== "INPUT") return;
    if ((t as HTMLInputElement).type === "checkbox" || (t as HTMLInputElement).type === "radio") return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    e.preventDefault();
    next();
  }

  return (
    <div className={className} onKeyDown={onKeyDown}>
      <div className="sm:hidden" aria-live="polite">
        <p className="text-xs font-semibold text-brand-teal">
          Step {p.number} of {p.total} · {labels[step] ?? ""}
        </p>
        <div role="progressbar" aria-label="Form progress" aria-valuemin={1} aria-valuemax={p.total} aria-valuenow={p.number} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-gray">
          <div className="h-full bg-brand-teal transition-all" style={{ width: `${(p.number / p.total) * 100}%` }} />
        </div>
      </div>

      {parts.map((part, i) => (
        <div key={i} ref={(el) => { refs.current[i] = el; }} className={i === step ? "" : "hidden sm:block"}>
          {part}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <button type="button" onClick={() => go(previousStep(step))} disabled={p.isFirst} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-gray-700 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:invisible">
          <Icon icon={ArrowLeft} size="sm" /> Back
        </button>
        {!p.isLast && (
          <button type="button" onClick={next} className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            Next <Icon icon={ArrowRight} size="sm" />
          </button>
        )}
      </div>

      {footer && <div className={p.isLast ? "" : "hidden sm:block"}>{footer}</div>}
    </div>
  );
}
