"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { useDialog } from "@/components/ui/useDialog";

/**
 * "Jump to a page" for people who work across dozens of screens. Opens
 * with Ctrl+K or Cmd+K, or from the Search button in the sidebar.
 * Type to filter the pages the signed-in role can reach, move with the
 * arrow keys, press Enter to go.
 *
 * Mount ONE <CommandPalette> per sidebar (it owns the keyboard
 * shortcut) and put a <PaletteTrigger> wherever a button should open
 * it. The trigger talks to the palette through a window event, so the
 * sidebar can render its body twice (desktop and drawer) without the
 * shortcut firing twice.
 */
export interface PaletteItem {
  label: string;
  href: string;
  group?: string | null;
}

const OPEN_EVENT = "aaicbi:open-palette";

export function PaletteTrigger({ onOpen }: { onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new Event(OPEN_EVENT));
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-brand-gray px-3 py-2 text-sm text-gray-600 hover:border-brand-teal hover:text-brand-teal"
    >
      <Icon icon={Search} size="sm" />
      <span className="flex-1 text-left">Search pages</span>
      <kbd className="rounded border border-brand-gray px-1.5 py-0.5 text-xs font-semibold">Ctrl K</kbd>
    </button>
  );
}

export default function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useDialog(open, () => setOpen(false), panelRef);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || (i.group ?? "").toLowerCase().includes(q));
  }, [items, query]);

  function go(item: PaletteItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-ink/40 px-4 pt-[15vh] backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-brand-surface shadow-xl animate-[modal-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-brand-gray px-4">
          <Icon icon={Search} size="sm" className="text-gray-600" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Search pages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Go to a page"
            className="w-full bg-transparent py-3.5 text-sm text-brand-ink outline-none placeholder:text-gray-500"
          />
        </div>
        <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-gray-600">No page matches &ldquo;{query}&rdquo;.</li>
          ) : (
            results.map((item, i) => (
              <li
                key={item.href}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  i === active ? "bg-brand-mint text-brand-teal" : "text-brand-ink"
                }`}
              >
                <span className="font-semibold">{item.label}</span>
                {item.group && <span className="text-xs text-gray-600">{item.group}</span>}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
