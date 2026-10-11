"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Briefcase, Building2, CalendarDays, Home, LayoutGrid, MessageSquare, Newspaper, Users, X, BookOpen, Plus } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { setBottomNavLayer } from "@/lib/floatingLayers";
import { BOTTOM_NAV, MORE_EXTRAS, bottomNavHidden, isTabActive, unreadLabel, type NavIconKey, type NavRole } from "@/lib/pwa/mobileNav";
import AddToHomeScreenButton from "@/components/pwa/AddToHomeScreenButton";
import { navTarget } from "@/lib/guide/navigation";

const ICONS: Record<NavIconKey, typeof Home> = {
  home: Home, messages: MessageSquare, events: CalendarDays, talent: Users, jobs: Briefcase, courses: BookOpen, organizations: Building2, alerts: Bell, feed: Newspaper, post: Plus,
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
  // Social look: the active tab sits in a soft pill behind its icon.
  const pill = (active: boolean) => (active ? "bg-brand-mint" : "");

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
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-brand-gray bg-brand-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-2xl focus:outline-none animate-[modal-in_0.15s_ease-out]"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-brand-ink">More</p>
              <button type="button" onClick={close} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                <Icon icon={X} size="md" />
              </button>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              <li>
                <Link href="/notifications" data-guide-target={navTarget("/notifications")} className="flex min-h-[48px] items-center justify-between rounded-xl border border-brand-teal bg-brand-mint px-3 text-sm font-semibold text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  <span className="flex items-center gap-2"><Bell aria-hidden="true" width={18} height={18} />Alerts</span>
                  {unread > 0 && <span className="rounded-full bg-brand-rose px-2 text-xs font-bold text-brand-onAccent">{unreadLabel(unread)}<span className="sr-only"> unread</span></span>}
                </Link>
              </li>
              {[...moreItems, ...extras].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} data-guide-target={navTarget(item.href)} className="flex min-h-[48px] items-center rounded-xl border border-brand-gray px-3 text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3"><AddToHomeScreenButton className="w-full justify-center" /></div>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-brand-gray bg-brand-surface shadow-[0_-8px_24px_rgb(0_0_0/0.12)] lg:hidden print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <ul className="flex">
          {tabs.map((t) => {
            const active = isTabActive(t, pathname);
            const TabIcon = ICONS[t.key];
            if (t.key === "post") {
              return (
                <li key={t.href} className="flex flex-1">
                  <Link href={t.href} data-guide-target={navTarget(t.href)} className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal">
                    <span className="flex h-8 w-14 items-center justify-center rounded-full bg-brand-teal text-brand-onAccent shadow-sm"><TabIcon aria-hidden="true" width={22} height={22} strokeWidth={2.75} /></span>
                    {t.label}
                  </Link>
                </li>
              );
            }
            return (
              <li key={t.href} className="flex flex-1">
                <Link href={t.href} data-guide-target={navTarget(t.href)} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${pill(active)}`}>
                    <TabIcon aria-hidden="true" width={22} height={22} strokeWidth={active ? 2.5 : 2} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button ref={moreButton} data-guide-target="more" type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="dialog" className={tabClass(moreOpen)}>
              <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${pill(moreOpen)}`}>
                <LayoutGrid aria-hidden="true" width={22} height={22} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1.5 min-w-[18px] rounded-full bg-brand-rose px-1 text-center text-[10px] font-bold leading-[18px] text-brand-onAccent">
                    {unreadLabel(unread)}
                    <span className="sr-only"> unread alerts</span>
                  </span>
                )}
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
