"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, HelpCircle } from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/investor/LogoutButton";
import Icon from "@/components/ui/Icon";
import { getNavIcon } from "@/components/icons/navIcons";
import MobileDrawer from "@/components/ui/MobileDrawer";
import CommandPalette, { PaletteTrigger } from "@/components/ui/CommandPalette";
import { INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV } from "@/lib/investor/nav";
import { getSidebarTourGuideContent } from "@/lib/tourGuideContent";

/**
 * Sidebar rollout (Phase 2) — the investor counterpart to
 * src/components/admin/AdminSidebar.tsx (see that file's own comment
 * for the fuller reasoning). Rendered once by src/app/investor/
 * layout.tsx, which also suppresses every investor page's own
 * SiteHeader call via SidebarActiveContext.
 *
 * No account card — investors have no profile page to link one to
 * (unlike admin/trainee/employer).
 */
export default function InvestorSidebar({ showOrganizations = false }: { showOrganizations?: boolean }) {
  const navItems = showOrganizations ? [...INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV] : INVESTOR_NAV;
  const pathname = usePathname() ?? "/investor/dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const tourEntry = getSidebarTourGuideContent(pathname);

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

      <div className="px-3 pt-3">
        <PaletteTrigger onOpen={() => setMobileOpen(false)} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${
              isActive(item.href)
                ? "bg-brand-mint text-brand-teal"
                : "text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
            }`}
          >
            <Icon icon={getNavIcon(item.href)} size="md" />
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
      <div className="flex items-center justify-between border-b border-brand-gray bg-brand-surface px-4 py-3 lg:hidden">
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

      <CommandPalette items={navItems} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        {sidebarBody}
      </MobileDrawer>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-brand-gray bg-brand-surface lg:block">
        {sidebarBody}
      </aside>
    </>
  );
}
