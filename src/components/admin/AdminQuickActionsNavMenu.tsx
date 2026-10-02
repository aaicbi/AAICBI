"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap, ChevronDown, ClipboardCheck, BookOpen, LineChart, BarChart3, MessageSquare, Wallet } from "lucide-react";
import Icon from "@/components/ui/Icon";

const QUICK_LINKS = [
  { label: "Examinations", href: "/admin/exams", icon: ClipboardCheck },
  { label: "Courses", href: "/admin/courses", icon: BookOpen },
  { label: "Performance", href: "/admin/performance", icon: LineChart },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Messages", href: "/admin/messages", icon: MessageSquare },
  { label: "Payments", href: "/admin/payments", icon: Wallet },
];

/**
 * Admin Dashboard & Examinations redesign (Phase 2) — the admin
 * equivalent of src/components/trainee/QuickActionsNavMenu.tsx, same
 * exact dropdown/outside-click/chevron pattern, rendered inside
 * LogoutButton.tsx the same way so every admin page gets it for free.
 * Static, curated shortcuts to real routes only — no new API, no
 * per-role dynamic data (that kind of real personalization belongs on
 * the dashboard's own QuickActionsCard, which already has it).
 */
export default function AdminQuickActionsNavMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Quick Actions"
        className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
      >
        <Icon icon={Zap} size="md" />
        <span className="hidden text-sm font-semibold sm:inline">Quick Actions</span>
        <Icon
          icon={ChevronDown}
          size="sm"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        // Admin sidebar pilot — this component is admin-only and (with
        // SiteHeader now suppressed on every authenticated admin page,
        // see SidebarActiveContext.tsx) only ever renders inside the
        // narrow left sidebar now, not a wide top bar. left-0 expands
        // the panel rightward into the main content area; right-0
        // (the old positioning) ran it off the left edge of the
        // screen from a button already near the sidebar's left side.
        <div className="absolute left-0 top-11 z-50 w-64 rounded-xl border border-brand-gray bg-brand-surface py-2 shadow-lg animate-[modal-in_0.15s_ease-out]">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-mint/40 hover:text-brand-teal"
            >
              <Icon icon={item.icon} size="sm" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
