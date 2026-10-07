"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, HelpCircle } from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/admin/LogoutButton";
import Icon from "@/components/ui/Icon";
import MobileDrawer from "@/components/ui/MobileDrawer";
import AvatarFallback from "@/components/ui/AvatarFallback";
import Badge from "@/components/ui/Badge";
import { getAdminNavGroups } from "@/lib/admin/nav";
import { getSidebarTourGuideContent } from "@/lib/tourGuideContent";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
};

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
 * NotificationBell/Logout (bundled in the existing LogoutButton.tsx)
 * sit right under the logo, not the sidebar's footer, specifically so
 * the notifications dropdown — which opens downward via
 * `absolute ... top-11` — needs no vertical repositioning.
 *
 * The account card (photo + name + role) between the logo and that
 * row is this sidebar's one way to reach /admin/profile — it replaced
 * a plain "My Profile" text link that used to sit in the nav list
 * below (see nav.ts's own comment). name/avatarUrl/role come from the
 * server layout (src/app/admin/layout.tsx), which already looks the
 * session's user up — no client-side fetch needed just to show them.
 */
export default function AdminSidebar({
  name,
  avatarUrl,
  role,
  isTrainingOrg,
}: {
  name: string;
  avatarUrl: string | null;
  role: string;
  /** Training Organizations, Phase 2 — see admin/layout.tsx's own
   * comment. Restricts the nav list and swaps the role badge for
   * "Training Organization", rather than the generic staff role label,
   * which would be misleading here (the underlying session role really
   * is ADMIN, but that's an implementation detail this account holder
   * has no reason to see). */
  isTrainingOrg?: boolean;
}) {
  const pathname = usePathname() ?? "/admin/dashboard";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const navGroups = getAdminNavGroups(role, isTrainingOrg);
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
        href="/admin/profile"
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 border-b border-brand-gray px-4 py-3 hover:bg-brand-mint ${
          isActive("/admin/profile") ? "bg-brand-mint" : ""
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
          <Badge variant="neutral">{isTrainingOrg ? "Training Organization" : (ROLE_LABELS[role] ?? role)}</Badge>
        </div>
      </Link>

      <div className="border-b border-brand-gray px-4 py-3">
        <LogoutButton />
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-3">
        {navGroups.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className={gi === 0 ? "" : "mt-4"}>
            {group.label && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive(item.href)
                    ? "bg-brand-mint text-brand-teal"
                    : "text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
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
