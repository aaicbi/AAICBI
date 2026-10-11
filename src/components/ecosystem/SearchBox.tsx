"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Icon from "@/components/ui/Icon";

interface Suggestion { kind: "profile" | "job" | "program" | "skill"; label: string; sub: string | null; href: string }
const KIND_LABEL: Record<Suggestion["kind"], string> = { profile: "Profile", job: "Job", program: "Program", skill: "Skill" };

/**
 * The search field. Typing two or more letters shows suggestions after a short pause (people, organizations, startups,
 * employers, jobs, programs and skills); arrow keys move through them, Enter opens the one you are on or runs the full search,
 * Escape closes the list. Without script it is an ordinary search form. Answers that arrive late for words already replaced
 * are ignored, and a failure simply shows no suggestions, never an error over the page.
 */
export default function SearchBox({ initialQuery = "", className = "", inputClassName = "", size = "md" }: { initialQuery?: string; className?: string; inputClassName?: string; size?: "md" | "lg" }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const word = q.trim();
    if (word.length < 2) { setItems([]); setBusy(false); setNote(null); return; }
    const mine = ++seq.current;
    setBusy(true);
    const t = window.setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(word)}`, { cache: "no-store" })
        .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({ items: [] })) }))
        .then(({ status, body }) => {
          if (mine !== seq.current) return;
          setItems(Array.isArray(body.items) ? body.items : []);
          setNote(status === 429 ? "Too many searches. Please wait a moment." : null);
          setActive(-1);
        })
        .catch(() => { if (mine === seq.current) { setItems([]); setNote(null); } })
        .finally(() => { if (mine === seq.current) setBusy(false); });
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function away(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  function go(e?: React.FormEvent) {
    e?.preventDefault();
    const pick = active >= 0 ? items[active] : null;
    setOpen(false);
    if (pick) return router.push(pick.href);
    const word = q.trim();
    if (word) router.push(`/search?q=${encodeURIComponent(word)}`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  }

  const showList = open && q.trim().length >= 2;
  return (
    <form ref={box} role="search" action="/search" onSubmit={go} className={`relative ${className}`}>
      <Icon icon={Search} size="sm" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
      <input
        type="search" name="q" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder="Search people, jobs, startups…" aria-label="Search the ecosystem" autoComplete="off" maxLength={80}
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={`${size === "lg" ? "h-12" : "h-11"} w-full rounded-full border border-brand-gray bg-brand-sand pl-11 pr-10 text-brand-ink placeholder:text-gray-600 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${inputClassName}`}
      />
      {busy && <span role="status" aria-label="Searching" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-gray border-t-brand-teal" />}
      {showList && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-brand-gray bg-brand-surface shadow-lg">
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {items.map((s, i) => (
              <li key={`${s.kind}-${s.href}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <a href={s.href} onMouseEnter={() => setActive(i)} onClick={() => setOpen(false)} className={`flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? "bg-brand-mint" : ""}`}>
                  <span className="min-w-0"><span className="block truncate font-semibold text-brand-ink">{s.label}</span>{s.sub && <span className="block truncate text-xs text-gray-700">{s.sub}</span>}</span>
                  <span className="shrink-0 rounded-full bg-brand-gray/40 px-2 py-0.5 text-[11px] font-semibold text-gray-800">{KIND_LABEL[s.kind]}</span>
                </a>
              </li>
            ))}
          </ul>
          {!busy && items.length === 0 && <p className="px-4 py-3 text-sm text-gray-700">{note ?? "No quick matches. Press Enter to search everything."}</p>}
          <button type="submit" onMouseDown={(e) => e.preventDefault()} onClick={() => setActive(-1)} className="flex min-h-[44px] w-full items-center border-t border-brand-gray px-4 text-left text-sm font-semibold text-brand-teal hover:bg-brand-mint">See all results for &ldquo;{q.trim()}&rdquo;</button>
        </div>
      )}
    </form>
  );
}
