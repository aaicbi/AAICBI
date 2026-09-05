import Link from "next/link";

/**
 * The AAICBI brand mark used across every page of the platform.
 *
 * This is an original mark built for this project in the AAICBI brand
 * palette (see tailwind.config.ts) — not a reproduction of any existing
 * logo file, since none was available to port in. If AAICBI has an
 * official logo asset (e.g. from the separate, more polished AAICBI CBT
 * Platform project), swap the <LogoMark> SVG below for that artwork —
 * everywhere else in the app that uses <Logo /> updates automatically.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#016B61" />
      {/* mortarboard */}
      <path d="M20 9 L31.5 15 L20 21 L8.5 15 Z" fill="#FFFFFF" />
      <path d="M14 17.3 V23.5 C14 25.7 16.7 27.5 20 27.5 C23.3 27.5 26 25.7 26 23.5 V17.3" stroke="#85C79A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="31.5" y1="15" x2="31.5" y2="22" stroke="#85C79A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface LogoProps {
  /** Where clicking the logo navigates. Pass `null` to render a static,
   * non-clickable mark instead — used on the one screen in the platform
   * where a "way out" link would be actively unwelcome: the live,
   * timed exam-taking page. See exam/[code]/take/page.tsx. */
  href?: string | null;
  /** Icon only, no "AAICBI / Learning Management System" wordmark —
   * for tight spaces if a future milestone needs one. */
  compact?: boolean;
  className?: string;
  /** Overrides the mark's own size (default h-8 w-8) — added for the
   * certificate page, where the logo needed to be genuinely part of
   * the certificate DOCUMENT itself, not just the page chrome around
   * it (see that page's own comment for why that distinction matters:
   * a printed or screenshotted certificate never includes SiteHeader).
   * A slightly larger mark reads better on a document meant to be
   * shared or printed than the header's default size does. */
  markClassName?: string;
}

export default function Logo({ href = "/", compact = false, className = "", markClassName = "h-8 w-8 shrink-0" }: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-bold text-brand-teal">AAICBI</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Learning Management System
          </span>
        </span>
      )}
    </span>
  );

  if (href === null) {
    return <span aria-label="AAICBI">{content}</span>;
  }

  return (
    <Link href={href} aria-label="AAICBI home" className="inline-flex items-center hover:opacity-80">
      {content}
    </Link>
  );
}
