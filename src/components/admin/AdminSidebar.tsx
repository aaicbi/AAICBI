"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, HelpCircle } from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/admin/LogoutButton";
import Icon from "@/components/ui/Icon";
import { getSidebarNavForPath } from "@/lib/admin/nav";
import { getTourGuideContent } from "@/lib/tourGuideContent";

/**
 * Admin sidebar pilot — replaces the old cramped top SiteHeader bar
 * for every authenticated admin page (see src/app/admin/layout.tsx,
 * which renders this and suppresses SiteHeader via
 * SidebarActiveContext). Trainee/employer/investor/instructor keep
 * the old top nav for now — see the plan this shipped from for why
 * this is a deliberate pilot, not the whole rollout.
 *
 * Nav content comes from getSidebarNavForPath (src/lib/admin/nav.ts),
 * a path-based lookup replacing the old "each page imports the right
 * constant" wiring — this component needs zero per-page input.
 *
 * NotificationBell/AdminQuickActionsNavMenu/Logout (bundled in the
 * existing LogoutButton.tsx) sit right under the logo, not the
 * sidebar's footer, specifically so their dropdowns — which already
 * open downward via `absolute ... top-11` — need no repositioning.
 */
export default function AdminSidebar() {
  const pathname = usePathname() ?? "/admin/dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const navItems = getSidebarNavForPath(pathname);
  const tourEntry = getTourGuideContent(pathname);

  useEffect(() => {
    setMobileOpen(false);
    setHelpOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="border-b border-brand-gray px-4 py-4">
        <Logo />
      </div>

      <div className="border-b border-brand-gray px-4 py-3">
        <LogoutButton />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
              isActive(item.href)
                ? "bg-brand-mint text-brand-teal"
                : "text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div ref={helpRef} className="relative border-t border-brand-gray p-3">
        {helpOpen && (
          <div className="absolute bottom-14 left-3 right-3 z-50 rounded-xl border border-brand-gray bg-brand-surface p-4 shadow-lg animate-[modal-in_0.15s_ease-out]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-sm font-semibold text-brand-ink">{tourEntry.title}</p>
              <button
                onClick={() => setHelpOpen(false)}
                aria-label="Close help"
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-brand-mint hover:text-brand-teal"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
              {tourEntry.notes.map((note, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-brand-teal">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
          aria-label={helpOpen ? "Close page help" : "Open page help"}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
        >
          <Icon icon={HelpCircle} size="md" />
          Page Help
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — the sidebar itself is hidden below sm:, so this
          is the only way to reach it on a small screen. Same hamburger
          pattern SiteHeader already proves. */}
      <div className="flex items-center justify-between border-b border-brand-gray bg-brand-surface px-4 py-3 sm:hidden">
        <Logo />
        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-mint"
        >
          <Icon icon={mobileOpen ? X : Menu} size="md" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-surface shadow-lg">{sidebarBody}</div>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-brand-gray bg-brand-surface sm:block">
        {sidebarBody}
      </aside>
    </>
  );
}
