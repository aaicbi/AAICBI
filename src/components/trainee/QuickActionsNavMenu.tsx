"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap, ChevronDown, BookOpen, ClipboardCheck, Award, BarChart3, MessageSquare, Bot, Download } from "lucide-react";
import Icon from "@/components/ui/Icon";

const QUICK_LINKS = [
  { label: "Courses", href: "/trainee/courses", icon: BookOpen },
  { label: "Examinations", href: "/trainee/examinations", icon: ClipboardCheck },
  { label: "Certificates", href: "/trainee/certificates", icon: Award },
  { label: "Analytics & Reports", href: "/trainee/my-activity", icon: BarChart3 },
  { label: "Messages", href: "/trainee/messages", icon: MessageSquare },
  { label: "Ask Loop", href: "/trainee/buddy", icon: Bot },
  { label: "My Downloads", href: "/trainee/downloads", icon: Download },
];

/**
 * Dashboard/Examination redesign — a static, curated shortcuts
 * dropdown available from every trainee page (rendered inside
 * LogoutButton.tsx, same "every trainee page gets this for free"
 * mechanism already used for NotificationBell). Deliberately NOT
 * per-trainee dynamic data (no new API) — that kind of real
 * personalization belongs on the dashboard's own QuickActionsCard,
 * which already has it. This is just quick navigation, reusing
 * NotificationBell's exact dropdown interaction pattern (toggle,
 * outside-click-to-close, aria-expanded).
 */
export default function QuickActionsNavMenu() {
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
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-brand-gray bg-brand-surface py-2 shadow-lg animate-[modal-in_0.15s_ease-out]">
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
