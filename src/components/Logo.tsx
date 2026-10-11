import Link from "next/link";
import { MARK_BIG, MARK_SMALL, MARK_DOT, WORDMARK_PATH, WORDMARK_WIDTH, WORDMARK_CAP_HEIGHT, PYRAMID_PATH, PYRAMID_WIDTH, PYRAMID_HEIGHT, PYRAMID_WORD_X, PYRAMID_WORD_Y, PYRAMID_BIG, PYRAMID_SMALL, PYRAMID_DOT } from "@/components/brand/wordmark";

/**
 * The AAICBI mark ("Nested Ascent"): a large chevron, a second chevron inside it, and one node.
 * Read as the letter A, as upward movement, and as the layers of the ecosystem around the point
 * where talent meets opportunity. Colours come from the platform's theme tokens, so the mark
 * follows light and dark mode. The artwork and its rules live in docs/brand/v3.
 *
 * `public/logo.svg` is a standalone static copy (the app-icon tile), because email clients can't
 * render a React component and notification emails point at that file by URL. Regenerate it with
 * docs/brand/v3/build_logo.py and keep it in sync with this mark.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <polygon points={MARK_BIG} className="fill-brand-tealDeep dark:fill-brand-ink" />
      <polygon points={MARK_SMALL} className="fill-brand-green dark:fill-brand-teal" />
      <circle cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r} className="fill-brand-gold" />
    </svg>
  );
}

/** The primary lockup: the mark stands on the word, and the two together fill one equilateral triangle: the mark's legs, extended, reach the first and last letters. Use it where it is at least about 120 px tall; below that the letters get too small to read. */
function PyramidLogo({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${PYRAMID_WIDTH} ${PYRAMID_HEIGHT}`} className={className} role="img" aria-label="AAICBI">
      <polygon points={PYRAMID_BIG} className="fill-brand-tealDeep dark:fill-brand-ink" />
      <polygon points={PYRAMID_SMALL} className="fill-brand-green dark:fill-brand-teal" />
      <circle cx={PYRAMID_DOT.cx} cy={PYRAMID_DOT.cy} r={PYRAMID_DOT.r} className="fill-brand-gold" />
      <path transform={`translate(${PYRAMID_WORD_X} ${PYRAMID_WORD_Y})`} d={PYRAMID_PATH} className="fill-brand-tealDeep dark:fill-brand-ink" />
    </svg>
  );
}

/** The AAICBI wordmark as outlined letters (Manrope ExtraBold), so it never depends on a webfont. */
function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 -${WORDMARK_CAP_HEIGHT} ${WORDMARK_WIDTH} ${WORDMARK_CAP_HEIGHT}`} className={className} aria-hidden="true">
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

interface LogoProps {
  /** Where clicking the logo navigates. Pass `null` to render a static,
   * non-clickable mark instead — used on the one screen in the platform
   * where a "way out" link would be actively unwelcome: the live,
   * timed exam-taking page. See exam/[code]/take/page.tsx. */
  href?: string | null;
  /** Symbol only, without the AAICBI wordmark, for tight spaces. */
  compact?: boolean;
  /** "pyramid" draws the primary lockup (mark above the word) and needs room: give it a height of 120 px or more via `markClassName`. The default, "beside", puts the word next to the mark and is the one for headers and bars. */
  layout?: "beside" | "pyramid";
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

export default function Logo({ href = "/", compact = false, layout = "beside", className = "", markClassName }: LogoProps) {
  const pyramid = layout === "pyramid" && !compact;
  const mark = markClassName ?? (pyramid ? "h-40 w-auto shrink-0" : "h-8 w-8 shrink-0");
  const content = pyramid ? (
    <span className={`inline-flex ${className}`}>
      <PyramidLogo className={mark} />
    </span>
  ) : (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={mark} />
      {!compact && (
        <Wordmark className="h-[13px] w-auto text-brand-tealDeep dark:text-brand-ink" />
      )}
    </span>
  );

  if (href === null) {
    return <span role="img" aria-label="AAICBI">{content}</span>;
  }

  return (
    <Link href={href} aria-label="AAICBI home" className="inline-flex items-center hover:opacity-80">
      {content}
    </Link>
  );
}
