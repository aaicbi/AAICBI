"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, HelpCircle } from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/trainee/LogoutButton";
import Icon from "@/components/ui/Icon";
import MobileDrawer from "@/components/ui/MobileDrawer";
import AvatarFallback from "@/components/ui/AvatarFallback";
import Badge from "@/components/ui/Badge";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import { getSidebarTourGuideContent } from "@/lib/tourGuideContent";

/**
 * Sidebar rollout (Phase 2) — the trainee counterpart to
 * src/components/admin/AdminSidebar.tsx, same structure and same
 * reasoning throughout (see that file's own comment for the fuller
 * explanation of each piece): rendered once by src/app/trainee/
 * layout.tsx, which also suppresses every trainee page's own
 * `<SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />` call via
 * SidebarActiveContext — no per-page changes needed.
 *
 * One flat nav list (TRAINEE_NAV), unlike admin's four clusters — the
 * trainee side has never needed more than one.
 */
export default function TraineeSidebar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const pathname = usePathname() ?? "/trainee/dashboard";
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

      <Link
        href="/trainee/profile"
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 border-b border-brand-gray px-4 py-3 hover:bg-brand-mint ${
          isActive("/trainee/profile") ? "bg-brand-mint" : ""
        }`}
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-mint">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <AvatarFallback size="md" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-ink">{name}</p>
          <Badge variant="neutral">Trainee</Badge>
        </div>
      </Link>

      <div className="border-b border-brand-gray px-4 py-3">
        <LogoutButton />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {TRAINEE_NAV.map((item) => (
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

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        {sidebarBody}
      </MobileDrawer>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-brand-gray bg-brand-surface lg:block">
        {sidebarBody}
      </aside>
    </>
  );
}
