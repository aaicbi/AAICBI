/**
 * Analytics System Phase 2 — the one client-side entry point every
 * public page/component calls to fire a visitor-tracking beacon.
 * Checks the consent cookie itself, client-side, BEFORE issuing any
 * request — a visitor who declined (or hasn't decided) never has their
 * browser make this call at all, not just have the server ignore it.
 * Fire-and-forget: never throws into its caller, never blocks
 * navigation.
 */
"use client";

export interface TrackVisitorEventOptions {
  type: "PAGE_VIEWED" | "COURSE_VIEWED" | "REGISTER_CLICKED" | "SEARCH_PERFORMED";
  path?: string;
  courseId?: string;
  // SEARCH_PERFORMED only.
  searchQuery?: string;
  resultCount?: number;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function hasAcceptedCookieConsent(): boolean {
  return readCookie("aaicbi_cookie_consent") === "accepted";
}

export function trackVisitorEvent(options: TrackVisitorEventOptions): void {
  try {
    if (!hasAcceptedCookieConsent()) return;

    const currentOrigin = window.location.origin;
    let referrerHostname: string | undefined;
    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        // Only an EXTERNAL referrer is meaningful traffic-source
        // information — same-origin means "came from another page on
        // this site," which categorizeReferrer should treat as direct
        // at the point of real external entry, not re-attributed on
        // every internal click.
        if (referrerUrl.origin !== currentOrigin) referrerHostname = referrerUrl.hostname;
      } catch {
        // Malformed/unreadable referrer — treat as no referrer.
      }
    }

    const utmSource = new URLSearchParams(window.location.search).get("utm_source") ?? undefined;

    void fetch("/api/analytics/visitor-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: options.type,
        path: options.path ?? window.location.pathname,
        courseId: options.courseId,
        referrerHostname,
        utmSource,
        searchQuery: options.searchQuery,
        resultCount: options.resultCount,
      }),
      // Lets the request outlive a page navigation (e.g. a
      // REGISTER_CLICKED beacon fired the instant before the browser
      // follows the link) — the standard, purpose-built API for this.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let a tracking failure affect the page itself.
  }
}
