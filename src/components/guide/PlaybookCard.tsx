"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Eye } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { getPlaybook } from "@/lib/guide/playbooks";
import { startTour } from "@/lib/guide/interactionStore";

const STORE = "loop-playbook-v1";

function readStep(id: string): number {
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, number>;
    return typeof all[id] === "number" ? all[id] : 0;
  } catch {
    return 0;
  }
}

function saveStep(id: string, step: number) {
  try {
    const all = JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, number>;
    all[id] = step;
    sessionStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* private mode: the guide just starts again after a reload */
  }
}

/** Shows **label** phrases in bold so exact interface labels stand out. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/**
 * One step of a guide at a time, with the page to open, a short tip and
 * Back / Next. The step is remembered for the visit, so closing Loop to try
 * a step and coming back picks up where you were.
 */
export default function PlaybookCard({ id, onNavigate, onAsk, onShow }: { id: string; onNavigate: () => void; onAsk: (q: string) => void; onShow?: () => void }) {
  const book = getPlaybook(id);
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(Math.min(readStep(id), (book?.steps.length ?? 1) - 1));
  }, [id, book]);
  if (!book) return null;

  const total = book.steps.length;
  const s = book.steps[step];
  const last = step === total - 1;
  const go = (n: number) => {
    setStep(n);
    saveStep(id, n);
  };
  const canShow = book.steps.some((x) => x.target);
  const showMe = () => {
    fetch("/api/guide/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "tour" }), keepalive: true }).catch(() => {});
    startTour(book.id, step);
    onNavigate();
    onShow?.();
  };
  const nextBooks = (book.next ?? []).map((n) => getPlaybook(n)).filter((b): b is NonNullable<typeof b> => !!b);

  return (
    <section aria-label={`Guide: ${book.title}`} className="mt-2.5 rounded-xl border border-brand-teal bg-brand-surface p-3">
      <p className="text-xs font-semibold text-brand-teal">
        {book.title} · Step {step + 1} of {total}
      </p>
      <div role="progressbar" aria-label="Guide progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-gray">
        <div className="h-full bg-brand-teal" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-brand-ink">{s.title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-brand-ink">
        <Marked text={s.text} />
      </p>
      {s.tip && (
        <p className="mt-2 rounded-lg bg-brand-mint px-2.5 py-1.5 text-xs text-brand-ink">
          <span className="font-semibold">Good to know: </span>
          <Marked text={s.tip} />
        </p>
      )}
      {canShow && (
        <button type="button" onClick={showMe} className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
          <span className="inline-flex items-center gap-1.5">
            <Eye size={16} aria-hidden="true" /> Show me on screen
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
      {s.href && (
        <Link href={s.href} onClick={onNavigate} className="mt-2.5 inline-flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border border-brand-teal bg-brand-surface px-3 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
          {s.hrefLabel ?? "Open this page"} <Icon icon={ArrowRight} size="sm" />
        </Link>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:cursor-not-allowed disabled:text-gray-400">
          <Icon icon={ArrowLeft} size="sm" /> Back
        </button>
        {last ? (
          <button type="button" onClick={() => go(0)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            <Icon icon={Check} size="sm" /> Done · restart
          </button>
        ) : (
          <button type="button" onClick={() => go(step + 1)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            Next <Icon icon={ArrowRight} size="sm" />
          </button>
        )}
      </div>
      {last && nextBooks.length > 0 && (
        <div className="mt-2.5 border-t border-brand-gray pt-2">
          <p className="text-xs text-gray-600">Guides to try next:</p>
          <ul className="mt-1 space-y-1">
            {nextBooks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onAsk(b.question)} className="text-left text-sm font-semibold text-brand-teal underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
