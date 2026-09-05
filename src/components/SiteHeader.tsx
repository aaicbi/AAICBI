"use client";
import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";

interface NavItem {
  label: string;
  href: string;
}

/**
 * The one consistent top bar every page in the platform renders,
 * so the AAICBI mark and the "click it to go home" behavior are
 * identical everywhere rather than re-implemented per page.
 *
 * Pass `right` for page-specific actions (a LogoutButton, typically).
 * Pass `nav` for a row of section links (e.g. Examinations / Courses on
 * the admin side) — added in M10 once there was a second real section
 * to navigate between; deliberately a plain prop, not path-matching
 * magic, so it's obvious from the call site which pages show which nav.
 * Pass `logoHref={null}` only for the live exam-taking screen — see the
 * comment on Logo's `href` prop for why that one page is the exception.
 *
 * Responsiveness fix: `nav` items used to be `hidden ... sm:flex` with
 * no mobile alternative at all — below 640px, every link in them was
 * completely unreachable, no hamburger, nothing. On a platform whose
 * trainees are very plausibly mobile-first, that's not "unpolished,"
 * it's a broken navigation on the majority device. Converted to a
 * client component (a safe, standard Next.js pattern — a Server
 * Component rendering this and passing `right={<LogoutButton />}` as
 * JSX works exactly as before) so the hamburger toggle can hold state.
 * `right` (typically a logout button) moves into the mobile panel too,
 * for the same reason — a control that only appears at desktop widths
 * isn't reachable on the device most trainees actually have.
 */
export default function SiteHeader({
  right,
  nav,
  logoHref = "/",
}: {
  right?: React.ReactNode;
  nav?: NavItem[];
  logoHref?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasMobileMenu = (nav && nav.length > 0) || !!right;

  return (
    <header className="relative border-b border-brand-gray">
      <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="flex items-center gap-8">
          <Logo href={logoHref} />
          {nav && nav.length > 0 && (
            <nav className="hidden items-center gap-5 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-semibold text-gray-600 hover:text-brand-teal"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="hidden sm:block">{right}</div>

        {hasMobileMenu && (
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-mint sm:hidden"
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6 L18 18 M18 6 L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
              </svg>
            )}
          </button>
        )}
      </div>

      {hasMobileMenu && mobileOpen && (
        // Audit finding, closed here: same hardcoded-`bg-white` gap as
        // Card's own — see that component's comment for the full
        // reasoning.
        <div className="absolute inset-x-0 top-full z-40 border-b border-brand-gray bg-brand-surface px-4 py-3 shadow-sm animate-[modal-in_0.15s_ease-out] sm:hidden">
          {nav && nav.length > 0 && (
            <nav className="flex flex-col">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-semibold text-gray-700 hover:bg-brand-mint hover:text-brand-teal"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {right && <div className="mt-2 border-t border-brand-gray pt-3">{right}</div>}
        </div>
      )}
    </header>
  );
}
