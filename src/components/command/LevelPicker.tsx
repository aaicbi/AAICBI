"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { LOOP_LEVELS, type LoopLevel } from "@/lib/loop/policy";

/** Picks how much Loop may do on its own, the way Claude picks a model. */
export default function LevelPicker({ level, onChange, disabled, max = 3 }: { level: LoopLevel; onChange: (l: LoopLevel) => void; disabled?: boolean; max?: LoopLevel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOOP_LEVELS.find((l) => l.level === level)!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      } else if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="level-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-gray-700 hover:bg-brand-gray/40 disabled:opacity-50"
      >
        <span className="rounded bg-brand-mint px-1.5 py-0.5 text-brand-tealDeep">{current.level}</span>
        {current.name}
        <Icon icon={ChevronDown} size="sm" />
      </button>
      {open && (
        <ul role="listbox" aria-label="How much Loop does on its own" className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-2xl border border-brand-gray bg-brand-surface p-1.5 shadow-lg">
          {LOOP_LEVELS.map((l) => (
            <li key={l.level}>
              <button
                type="button"
                role="option"
                aria-selected={l.level === level}
                aria-disabled={l.level > max}
                disabled={l.level > max}
                data-testid={`level-${l.level}`}
                onClick={() => {
                  onChange(l.level);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-brand-gray/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-mint text-xs font-bold text-brand-tealDeep">{l.level}</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-brand-ink">{l.name}</span>
                  <span className="block text-xs text-gray-600">{l.level > max ? "Not unlocked for you. A Super Admin can allow it." : l.description}</span>
                </span>
                {l.level === level && <Icon icon={Check} size="sm" className="mt-1 text-brand-teal" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
