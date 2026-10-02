"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { getTourGuideContent } from "@/lib/tourGuideContent";

/**
 * A persistent, platform-wide "page help" button — fixed bottom-right
 * on every page (mounted once in src/app/layout.tsx, same pattern as
 * ToastProvider/CookieConsentBanner). Deliberately NOT the spotlight/
 * element-anchored tour style src/components/OnboardingWalkthrough.tsx
 * already documents rejecting (fragile — breaks on scroll, resize,
 * and mobile layouts): this is a fixed-position affordance that never
 * needs to track a live element.
 *
 * Same open/closed + outside-click-to-close mechanics already proven
 * in NotificationBell.tsx. No "seen" persistence — unlike the one-time
 * onboarding walkthrough, this is meant to be reopened on any page, any
 * time, which is the whole point of it being always there.
 */
export default function TourGuideButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const entry = getTourGuideContent(pathname ?? "/");

  // Admin sidebar pilot — /admin/* now has its own "Page Help" row
  // inside AdminSidebar.tsx, reusing this same getTourGuideContent
  // table. Keeping both mounted would just show the same content
  // twice. Every other page is unaffected.
  const isAdmin = pathname?.startsWith("/admin");

  // Rules of Hooks: the two effects below must still run on every
  // render (even one we're about to render null for), so the early
  // return happens after them, not before.

  // Close whenever the trainee navigates to a different page — the
  // notes are about the page they were just reading, not wherever they
  // land next.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isAdmin) return null;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="absolute bottom-14 right-0 w-72 max-w-[85vw] rounded-xl border border-brand-gray bg-brand-surface p-4 shadow-lg animate-[modal-in_0.15s_ease-out]">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-sm font-semibold text-brand-ink">{entry.title}</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-brand-mint hover:text-brand-teal"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
            {entry.notes.map((note, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-brand-teal">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close page help" : "Open page help"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-tealDeep"
      >
        <Icon icon={open ? X : HelpCircle} size="md" />
      </button>
    </div>
  );
}
