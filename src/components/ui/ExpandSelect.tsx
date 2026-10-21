"use client";
import { Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * The platform's replacement for the browser dropdown on computers (large screens). Phones and tablets keep the plain native dropdown exactly
 * as it was; the same control is in the page either way, and the screen size decides which one shows.
 *
 * The replacement: a button that expands the choices in place, each with an optional short
 * description (`data-description` on the <option>). It takes the same props and the same <option>/<optgroup> children as a native
 * <select>, and keeps a hidden native <select> as the source of truth, so forms, refs, `name`, `required`, `onChange(e)` and
 * `defaultValue` behave exactly as before. Long lists get a search box. Arrow keys, Home/End, Enter, Escape and typing work.
 */
export interface ExpandOption { value: string; label: string; description?: string; disabled?: boolean; group?: string }

const textOf = (node: ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
};

/** Flattens <option>, <optgroup>, fragments and mapped arrays into one list. Pure, so it can be tested. */
export function optionsFromChildren(children: ReactNode, group?: string): ExpandOption[] {
  const out: ExpandOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean; "data-description"?: string }>;
    if (el.type === Fragment) out.push(...optionsFromChildren(el.props.children, group));
    else if (el.type === "optgroup") out.push(...optionsFromChildren(el.props.children, el.props.label ?? group));
    else if (el.type === "option") {
      const label = textOf(el.props.children).trim();
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : label, label, description: el.props["data-description"], disabled: el.props.disabled, group });
    }
  });
  return out;
}

const SEARCH_AFTER = 8;

/**
 * Callers that used to style a native <select> pass its border, radius, margin and width in `className`. Here the border and radius
 * belong to the outer box and margin and width to the wrapper, so each class goes where it still means something; colours
 * and shadows are dropped (the picker draws its own).
 */
export function splitClasses(className?: string): { wrapper: string; radius: string; head: string } {
  const out = { wrapper: [] as string[], radius: [] as string[], head: [] as string[] };
  for (const t of (className ?? "").split(/\s+/).filter(Boolean)) {
    if (/^(m[trblxy]?-|w-|max-w-|min-w-|flex-|grow|shrink|self-|col-span|basis-)/.test(t)) out.wrapper.push(t.includes(":") ? t : `lg:${t}`);
    else if (/^rounded/.test(t)) out.radius.push(t);
    else if (/^(border|bg-|shadow|focus:|outline|ring|block$|inline)/.test(t)) continue;
    else out.head.push(t);
  }
  return { wrapper: out.wrapper.join(" "), radius: out.radius.join(" "), head: out.head.join(" ") };
}

type NativeProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size">;
export interface ExpandSelectProps extends NativeProps {
  /** Dense rows and toolbars: chevron only, no word. */
  compact?: boolean;
  invalid?: boolean;
  /** "dark" for the game screens, which are dark whatever the theme. */
  tone?: "default" | "dark";
  /** Classes for the outer element (width, margin, flex sizing). */
  wrapperClassName?: string;
  /** How the plain dropdown looks on phones and tablets, which keep it. Defaults to `className`. */
  nativeClassName?: string;
  /** Describes the control for assistive tech when there is no visible <label>. */
  "aria-label"?: string;
}

const ExpandSelect = forwardRef<HTMLSelectElement, ExpandSelectProps>(function ExpandSelect(
  { compact, invalid, tone = "default", wrapperClassName, nativeClassName, className, style, id, children, value, defaultValue, onChange, disabled, "aria-label": ariaLabel, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, ...native },
  ref
) {
  const auto = useId();
  const baseId = id ?? `xs-${auto}`;
  const headId = `${baseId}-picker`;
  const listId = `${baseId}-list`;
  const selectEl = useRef<HTMLSelectElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const options = useMemo(() => optionsFromChildren(children), [children]);
  const [own, setOwn] = useState<string>(() => String(defaultValue ?? options[0]?.value ?? ""));
  const current = value !== undefined ? String(Array.isArray(value) ? value[0] : value) : own;
  const selected = options.find((o) => o.value === current);
  const searchable = options.length > SEARCH_AFTER;
  const shown = useMemo(() => (query ? options.filter((o) => `${o.label} ${o.description ?? ""}`.toLowerCase().includes(query.toLowerCase())) : options), [options, query]);

  const setRefs = useCallback(
    (el: HTMLSelectElement | null) => {
      selectEl.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
    },
    [ref]
  );

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) head.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) close(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  // On opening, put the cursor on the chosen item (or the search box on a long list).
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, shown.findIndex((o) => o.value === current));
    setActive(i);
    if (!searchable) root.current?.querySelectorAll<HTMLElement>("[data-xs-opt]")[i]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pick(o: ExpandOption) {
    if (o.disabled) return;
    const el = selectEl.current;
    if (el && o.value !== current) {
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      set?.call(el, o.value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (value === undefined) setOwn(o.value);
    close(true);
  }

  function focusOpt(i: number) {
    const n = shown.length;
    if (!n) return;
    const next = (i + n) % n;
    setActive(next);
    root.current?.querySelectorAll<HTMLElement>("[data-xs-opt]")[next]?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); focusOpt(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusOpt(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusOpt(0); }
    else if (e.key === "End") { e.preventDefault(); focusOpt(shown.length - 1); }
    else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      // type to jump
      const k = e.key.toLowerCase();
      const from = shown.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k));
      const j = from >= 0 ? from : shown.findIndex((o) => o.label.toLowerCase().startsWith(k));
      if (j >= 0) focusOpt(j);
    }
  }

  // On a computer the picker is the control, so the plain select behind it is kept out of the keyboard order and away from screen readers.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [labelText, setLabelText] = useState<string | undefined>(undefined);
  useEffect(() => { const l = document.querySelector(`label[for="${CSS.escape(baseId)}"]`); setLabelText(l?.textContent?.replace("*", "").trim() || undefined); }, [baseId]);
  const cls = splitClasses(className);
  const dark = tone === "dark";
  const isPlaceholder = !selected || selected.value === "";
  let lastGroup: string | undefined;

  return (
    <div ref={root} className={`max-lg:contents lg:relative lg:block lg:min-w-0 lg:max-w-full ${cls.wrapper} ${wrapperClassName ? wrapperClassName.split(/\s+/).map((t) => (t.includes(":") ? t : `lg:${t}`)).join(" ") : ""}`} data-expand-select data-open={open ? "true" : "false"}>
      {/* The real control: keeps forms, refs, validation and onChange working. Not shown. */}
      <select
        ref={setRefs}
        {...native}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange}
        disabled={disabled}
        id={id}
        tabIndex={desktop ? -1 : undefined}
        aria-hidden={desktop ? true : undefined}
        onFocus={(e) => { if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) { e.currentTarget.blur(); head.current?.focus(); } }}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        className={`${nativeClassName ?? className ?? ""} lg:pointer-events-none lg:absolute lg:h-px lg:w-px lg:overflow-hidden lg:p-0 lg:opacity-0`}
        style={style}
      >
        {children}
      </select>

      <div className={`hidden overflow-hidden border lg:block ${cls.radius || "rounded-lg"} ${dark ? "border-white/25 bg-black/30 text-white" : `bg-brand-surface ${invalid || ariaInvalid ? "border-brand-rose" : "border-brand-gray"} ${open ? "border-brand-teal" : ""}`} ${disabled ? "opacity-60" : ""}`}>
        <button
          ref={head}
          type="button"
          id={headId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel ?? labelText}
          aria-describedby={describedBy}
          style={style}
          onClick={() => (open ? close(false) : setOpen(true))}
          onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setOpen(true); } if (open && e.key === "Escape") { e.preventDefault(); close(true); } }}
          className={`flex w-full items-center justify-between gap-2 bg-transparent text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${dark ? "text-white" : "text-brand-ink"} ${compact ? "min-h-[36px] px-2.5 py-1" : "min-h-[44px] px-3 py-2"} ${cls.head}`}
        >
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${isPlaceholder ? "text-gray-500" : "font-semibold"}`}>{selected?.label || (options.length ? "Choose" : "")}</span>
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-bold ${dark ? "text-white/80" : "text-brand-teal"}`}>
            {!compact && <span>{open ? "Collapse" : "Expand"}</span>}
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : ""}`} fill="currentColor"><path d="M7 4l6 6-6 6V4z" /></svg>
          </span>
        </button>

        {open && (
          <div id={listId} role="listbox" aria-label={ariaLabel ?? labelText} onKeyDown={onListKey} className={`max-h-64 overflow-y-auto border-t ${dark ? "border-white/20" : "border-brand-gray"}`}>
            {searchable && (
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); focusOpt(0); } else if (e.key === "Enter") { e.preventDefault(); if (shown[0]) pick(shown[0]); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); } }}
                placeholder="Type to find"
                aria-label="Search the choices"
                className={`block min-h-[42px] w-full border-b bg-transparent px-3 text-sm outline-none ${dark ? "border-white/20 text-white placeholder:text-white/60" : "border-brand-gray text-brand-ink"}`}
              />
            )}
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-gray-600">Nothing matches.</p>}
            {shown.map((o, i) => {
              const showGroup = o.group && o.group !== lastGroup;
              lastGroup = o.group;
              return (
                <Fragment key={`${o.value}-${i}`}>
                  {showGroup && <p className="bg-brand-mint/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{o.group}</p>}
                  <button
                    type="button"
                    role="option"
                    data-xs-opt
                    aria-selected={o.value === current}
                    aria-disabled={o.disabled || undefined}
                    tabIndex={i === active ? 0 : -1}
                    onClick={() => pick(o)}
                    className={`flex w-full items-start gap-2.5 border-b px-3 text-left text-sm last:border-b-0 focus:outline-none ${dark ? "border-white/15 text-white hover:bg-white/15 focus:bg-white/15" : "border-brand-gray text-brand-ink hover:bg-brand-mint focus:bg-brand-mint"} ${compact ? "min-h-[38px] py-1.5" : "min-h-[44px] py-2"} ${o.value === current ? (dark ? "bg-white/10" : "bg-brand-mint/60") : ""} ${o.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 font-extrabold ${dark ? "text-white" : "text-brand-teal"}`}>{o.value === current ? "✓" : ""}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold [overflow-wrap:anywhere]">{o.label}</span>
                      {o.description && <span className={`block text-xs font-normal ${dark ? "text-white/70" : "text-gray-600"}`}>{o.description}</span>}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default ExpandSelect;
