"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, ChevronDown, ClipboardCheck, Folder, GraduationCap, Newspaper, Settings, Wallet, type LucideIcon } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { getNavIcon } from "@/components/icons/navIcons";
import { navTarget } from "@/lib/guide/navigation";
import type { AdminNavGroup } from "@/lib/admin/nav";

const GROUP_ICONS: Record<string, LucideIcon> = {
  Feed: Newspaper,
  Review: ClipboardCheck,
  Teaching: GraduationCap,
  Organization: Building2,
  Insight: BarChart3,
  Money: Wallet,
  Platform: Settings,
};
const groupIcon = (label: string): LucideIcon => GROUP_ICONS[label] ?? Folder;

function readStored(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}
function writeStored(key: string, v: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window or blocked storage: the menu still works, it just forgets */
  }
}

/**
 * The sidebar's sections as dropdowns. A section that holds one page is just that page; a section with several opens and closes.
 * The section holding the page you are on is always open, the rest start closed, and what you open or close is remembered on
 * this device. Every page link stays in the document (hidden while closed), and Loop can open a section to point at a page in it.
 */
export default function NavAccordion({
  groups,
  activeHref,
  onNavigate,
  storageKey,
}: {
  groups: AdminNavGroup[];
  activeHref: string | null;
  onNavigate?: () => void;
  storageKey: string;
}) {
  const sectionOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) if (g.label) for (const i of g.items) m.set(i.href, g.label);
    return m;
  }, [groups]);
  const activeSection = activeHref ? sectionOf.get(activeHref) ?? null : null;

  const [open, setOpen] = useState<Set<string>>(() => new Set(activeSection ? [activeSection] : []));

  // After the first paint, bring back what this person left open, and always keep the current page's section open.
  useEffect(() => {
    const stored = readStored(storageKey);
    setOpen((cur) => {
      const next = new Set(stored ?? []);
      cur.forEach((s) => next.add(s));
      if (activeSection) next.add(activeSection);
      return next;
    });
  }, [storageKey, activeSection]);

  const toggle = useCallback(
    (label: string) => {
      setOpen((cur) => {
        const next = new Set(cur);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        writeStored(storageKey, Array.from(next));
        return next;
      });
    },
    [storageKey],
  );

  // Loop asks for a menu item that sits in a closed section: open it.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      const section = typeof href === "string" ? sectionOf.get(href) : undefined;
      if (section) setOpen((cur) => (cur.has(section) ? cur : new Set(cur).add(section)));
    };
    window.addEventListener("aaicbi:reveal-nav", onReveal);
    return () => window.removeEventListener("aaicbi:reveal-nav", onReveal);
  }, [sectionOf]);

  const link = (item: { label: string; href: string }, nested: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      data-guide-target={navTarget(item.href)}
      onClick={onNavigate}
      aria-current={item.href === activeHref ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg py-2 text-sm font-semibold ${nested ? "pl-3 pr-3" : "px-3"} ${
        item.href === activeHref ? "bg-brand-mint text-brand-teal" : "text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
      }`}
    >
      <Icon icon={getNavIcon(item.href)} size="md" />
      {item.label}
    </Link>
  );

  return (
    <>
      {groups.map((group, gi) => {
        // No heading, or just one page: show the page itself.
        if (!group.label || group.items.length === 1) {
          return (
            <div key={group.label ?? `group-${gi}`} className={gi === 0 ? "" : "mt-1"}>
              {group.items.map((item) => link(item, false))}
            </div>
          );
        }
        const isOpen = open.has(group.label);
        const hasActive = group.items.some((i) => i.href === activeHref);
        const id = `nav-section-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        return (
          <div key={group.label} className="mt-1">
            <button
              type="button"
              onClick={() => toggle(group.label as string)}
              aria-expanded={isOpen}
              aria-controls={id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                hasActive ? "text-brand-teal" : "text-brand-ink"
              }`}
            >
              <Icon icon={groupIcon(group.label)} size="md" />
              <span className="flex-1">{group.label}</span>
              <Icon icon={ChevronDown} size="sm" className={`transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <div id={id} hidden={!isOpen} className="ml-5 mt-0.5 space-y-0.5 border-l border-brand-gray pl-2">
              {group.items.map((item) => link(item, true))}
            </div>
          </div>
        );
      })}
    </>
  );
}
