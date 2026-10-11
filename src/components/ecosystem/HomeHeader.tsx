"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, Search, X } from "lucide-react";
import Logo from "@/components/Logo";
import Icon from "@/components/ui/Icon";
import AvatarFallback from "@/components/ui/AvatarFallback";
import AddToHomeScreenButton from "@/components/pwa/AddToHomeScreenButton";

export interface Summary { signedIn: boolean; name?: string; avatarUrl?: string | null; square?: boolean; handle?: string | null; kindLabel?: string | null; dashboardHref?: string }

const PRIMARY = [
  { href: "/", label: "Feed" },
  { href: "/organizations", label: "Organizations" },
  { href: "/trainees", label: "Trainees" },
  { href: "/jobs", label: "Jobs" },
  { href: "/startups", label: "Startups" },
  { href: "/learn", label: "Learn" },
  { href: "/events", label: "Events" },
];

/**
 * The header of the public ecosystem pages: the logo, a search field that is always in view, and the account actions.
 * Visitors get "Log in" and "Create account". Signed-in people get a "Dashboard" button and a menu with their profile,
 * posts and sign out. Whether someone is signed in is asked of /api/session/summary after the page loads, so the pages
 * themselves can stay cacheable; until the answer arrives the account area is a placeholder of the same size.
 */
export default function HomeHeader({ initialQuery = "", initial }: { initialQuery?: string; initial?: Summary }) {
  // Where the page already knows who is looking (the feed does) it says so, and nothing flickers. Elsewhere the page is
  // shared and cacheable, so it starts as the visitor view and /api/session/summary corrects it a moment after load.
  const [me, setMe] = useState<Summary | null>(initial ?? { signedIn: false });
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    try { if (localStorage.getItem("aaicbi_member") === "1") setMe(null); } catch { /* storage may be blocked */ }
    fetch("/api/session/summary", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { signedIn: false })).then((d) => { if (!live) return; setMe(d); try { localStorage.setItem("aaicbi_member", d.signedIn ? "1" : "0"); } catch { /* ignore */ } }).catch(() => live && setMe({ signedIn: false }));
    return () => { live = false; };
  }, [initial]);
  useEffect(() => { setMenu(false); setOpen(false); }, [pathname]);
  useEffect(() => {
    function away(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }
  const active = (href: string) => (href === "/" ? pathname === "/" || pathname === "/feed" : pathname === href || pathname.startsWith(href + "/"));
  const next = encodeURIComponent(pathname === "/" ? "/" : pathname);

  const accountArea = me === null ? (
    <div className="h-10 w-44 animate-pulse rounded-full bg-brand-mint" aria-hidden="true" />
  ) : me.signedIn ? (
    <div className="flex items-center gap-2">
      <Link href={me.dashboardHref ?? "/"} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">
        <Icon icon={LayoutDashboard} size="sm" />Dashboard
      </Link>
      <div ref={box} className="relative">
        <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="Your account" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-brand-gray bg-brand-mint">
          {me.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={me.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback size="sm" />}
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-brand-gray bg-brand-surface p-2 shadow-lg">
            <div className="px-3 py-2"><p className="truncate text-sm font-semibold text-brand-ink">{me.name}</p>{me.kindLabel && <p className="truncate text-xs text-gray-600">{me.kindLabel}</p>}</div>
            {[[me.dashboardHref ?? "/", "My dashboard"], ...(me.handle ? [[`/@${me.handle}`, "My profile"]] : []), ["/compose", "Write a post"], ["/my-posts", "My posts"], ["/saved", "Saved posts"], ["/notifications", "Notifications"]].map(([h, l]) => (
              <Link key={h} role="menuitem" href={h} className="flex min-h-[40px] items-center rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint">{l}</Link>
            ))}
            <button type="button" role="menuitem" onClick={signOut} className="flex min-h-[40px] w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-brand-rose hover:bg-brand-roseLight">Sign out</button>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href={`/login?next=${next}`} className="inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-semibold text-brand-teal hover:bg-brand-mint">Log in</Link>
      <Link href="/join" className="inline-flex min-h-[40px] items-center rounded-full bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Create account</Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-brand-gray bg-brand-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Logo />
        <form role="search" action="/search" onSubmit={(e) => { const q = String(new FormData(e.currentTarget).get("q") ?? "").trim(); if (!q) e.preventDefault(); }} className="relative hidden min-w-0 flex-1 md:block md:max-w-xl lg:mx-4">
          <Icon icon={Search} size="sm" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="search" name="q" defaultValue={initialQuery} placeholder="Search people, organizations, courses and posts" aria-label="Search the ecosystem" autoComplete="off" className="h-11 w-full rounded-full border border-brand-gray bg-brand-sand pl-11 pr-4 text-sm text-brand-ink placeholder:text-gray-600 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal" />
        </form>
        <div className="ml-auto hidden md:block">{accountArea}</div>
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {me?.signedIn ? (
            <Link href={me.dashboardHref ?? "/"} className="inline-flex min-h-[40px] items-center rounded-full bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent">Dashboard</Link>
          ) : me ? (
            <Link href="/join" className="inline-flex min-h-[40px] items-center rounded-full bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent">Join</Link>
          ) : null}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className="flex h-10 w-10 items-center justify-center rounded-full text-brand-ink hover:bg-brand-mint">
            <Icon icon={open ? X : Menu} size="md" />
          </button>
        </div>
      </div>

      <form role="search" action="/search" onSubmit={(e) => { const q = String(new FormData(e.currentTarget).get("q") ?? "").trim(); if (!q) e.preventDefault(); }} className="relative px-4 pb-2.5 md:hidden">
        <Icon icon={Search} size="sm" className="pointer-events-none absolute left-8 top-1/2 -translate-y-[calc(50%+5px)] text-gray-600" />
        <input type="search" name="q" defaultValue={initialQuery} placeholder="Search people, organizations, courses and posts" aria-label="Search the ecosystem" autoComplete="off" className="h-11 w-full rounded-full border border-brand-gray bg-brand-sand pl-11 pr-4 text-base text-brand-ink placeholder:text-gray-600 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal" />
      </form>

      <nav aria-label="Explore" className="hidden border-t border-brand-gray md:block">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {PRIMARY.map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold ${active(l.href) ? "border-b-2 border-brand-teal text-brand-teal" : "text-gray-600 hover:text-brand-ink"}`}>{l.label}</Link>
          ))}
          <Link href="/certificate" className="ml-auto whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-brand-ink">Verify a certificate</Link>
        </div>
      </nav>

      {open && (
        <div className="border-t border-brand-gray bg-brand-surface px-4 py-3 md:hidden">
          <nav aria-label="Explore (menu)" className="flex flex-col">
            {[...PRIMARY, { href: "/courses", label: "Courses" }, { href: "/certificate", label: "Verify a certificate" }].map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold ${active(l.href) ? "bg-brand-mint text-brand-teal" : "text-brand-ink hover:bg-brand-mint"}`}>{l.label}</Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-brand-gray pt-3">
            <div className="mb-2"><AddToHomeScreenButton label="Install app" className="w-full justify-center" /></div>
            {me?.signedIn ? (
              <div className="flex flex-col">
                {[...(me.handle ? [[`/@${me.handle}`, "My profile"]] : []), ["/compose", "Write a post"], ["/my-posts", "My posts"], ["/saved", "Saved posts"], ["/notifications", "Notifications"]].map(([h, l]) => <Link key={h} href={h} className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint">{l}</Link>)}
                <button type="button" onClick={signOut} className="flex min-h-[44px] items-center rounded-xl px-3 text-left text-sm font-semibold text-brand-rose hover:bg-brand-roseLight">Sign out</button>
              </div>
            ) : me ? (
              <div className="flex gap-2">
                <Link href={`/login?next=${next}`} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-brand-teal text-sm font-semibold text-brand-teal">Log in</Link>
                <Link href="/join" className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-brand-teal text-sm font-semibold text-brand-onAccent">Create account</Link>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
