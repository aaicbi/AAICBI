"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, Building2, CalendarDays, Download, Home, LayoutGrid, MessageSquare, Users, X, BookOpen } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { setBottomNavLayer } from "@/lib/floatingLayers";
import { BOTTOM_NAV, MORE_EXTRAS, bottomNavHidden, isTabActive, unreadLabel, type NavIconKey, type NavRole } from "@/lib/pwa/mobileNav";
import { promptInstall, useInstallState } from "@/lib/pwa/installStore";

const ICONS: Record<NavIconKey, typeof Home> = {
  home: Home, messages: MessageSquare, events: CalendarDays, talent: Users, jobs: Briefcase, courses: BookOpen, organizations: Building2, alerts: Bell,
};

/** Unread notification count for the Alerts tab, refreshed every minute while the page is visible. */
function useUnread(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      fetch("/api/notifications", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => live && d && typeof d.unreadCount === "number" && setCount(d.unreadCount))
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 60_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return count;
}

/**
 * The bottom navigation on phones and tablets in portrait: the handful of
 * places used every day for this kind of account, with an unread count on
 * Alerts, and "More" opening the full menu in a sheet. Large screens keep
 * their sidebar and never see this.
 */
export default function MobileBottomNav({ role, moreItems }: { role: NavRole; moreItems: Array<{ label: string; href: string }> }) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = useUnread();
  const hidden = bottomNavHidden(pathname);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const install = useInstallState();

  // Tell the other floating layers (Loop, help button, cookie banner) to sit above the bar.
  useEffect(() => {
    if (hidden) return;
    const phone = window.matchMedia("(max-width: 1023px)");
    const sync = () => setBottomNavLayer(phone.matches);
    sync();
    phone.addEventListener("change", sync);
    return () => {
      phone.removeEventListener("change", sync);
      setBottomNavLayer(false);
    };
  }, [hidden]);

  useEffect(() => setMoreOpen(false), [pathname]);

  const close = useCallback(() => {
    setMoreOpen(false);
    moreButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen, close]);

  if (hidden) return null;
  const tabs = BOTTOM_NAV[role];
  const extras = MORE_EXTRAS[role].filter((x) => !moreItems.some((m) => m.href === x.href));
  const tabClass = (active: boolean) =>
    `relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal ${active ? "text-brand-teal" : "text-gray-600"}`;

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button type="button" aria-label="Close menu" onClick={close} className="absolute inset-0 bg-black/50" tabIndex={-1} />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-brand-gray bg-brand-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl focus:outline-none animate-[modal-in_0.15s_ease-out]"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-brand-ink">More</p>
              <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                <Icon icon={X} size="md" />
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {[...moreItems, ...extras].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-[48px] items-center rounded-xl border border-brand-gray px-3 text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {!install.installed && (install.canPrompt || install.ios) && (
              <div className="mt-3 rounded-xl bg-brand-mint p-3 text-sm text-brand-ink">
                <p className="font-semibold">Install the app</p>
                {install.canPrompt ? (
                  <button type="button" onClick={() => promptInstall()} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-teal px-4 font-semibold text-brand-onAccent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
                    <Icon icon={Download} size="sm" /> Add to home screen
                  </button>
                ) : (
                  <p className="mt-1">In Safari, tap Share, then <strong>Add to Home Screen</strong>.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-gray bg-brand-surface lg:hidden print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="flex">
          {tabs.map((t) => {
            const active = isTabActive(t, pathname);
            const TabIcon = ICONS[t.key];
            return (
              <li key={t.href} className="flex flex-1">
                <Link href={t.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <span className="relative">
                    <TabIcon aria-hidden="true" width={22} height={22} strokeWidth={active ? 2.5 : 2} />
                    {t.key === "alerts" && unread > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-brand-rose px-1 text-center text-[10px] font-bold leading-[18px] text-brand-onAccent">
                        {unreadLabel(unread)}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button ref={moreButton} type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="dialog" className={tabClass(moreOpen)}>
              <LayoutGrid aria-hidden="true" width={22} height={22} />
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
