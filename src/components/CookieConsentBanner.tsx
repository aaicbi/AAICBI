"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

import { setFloatingOffset } from "@/lib/floatingLayers";
const CONSENT_COOKIE = "aaicbi_cookie_consent";

function readConsentCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Analytics System Phase 2 — the one cookie-consent banner on the
 * whole site, mounted once in the root layout (src/app/layout.tsx) so
 * it appears exactly once, site-wide, until a decision is recorded —
 * never a modal, never blocking the page underneath it. Opt-in: no
 * `aaicbi_visitor_id` cookie and no VisitorEvent row is ever created
 * until "Accept" is actually clicked — see visitorCookies.ts's own
 * comment for the full reasoning.
 *
 * Also listens for a custom `aaicbi:reopen-cookie-banner` window event —
 * the Privacy Policy page's "Manage Cookie Preferences" control
 * dispatches this after clearing both cookies, so the banner reappears
 * in the same tab without a full page reload.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(readConsentCookie() === null);
    const reopen = () => setVisible(true);
    window.addEventListener("aaicbi:reopen-cookie-banner", reopen);
    return () => window.removeEventListener("aaicbi:reopen-cookie-banner", reopen);
  }, []);

  // Tell the other floating layers how much room the banner takes, so
  // they sit above it instead of underneath it.
  useEffect(() => {
    const el = ref.current;
    if (!visible || !el) return;
    const report = () => setFloatingOffset("banner", el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setFloatingOffset("banner", 0);
    };
  }, [visible]);

  async function decide(decision: "accepted" | "declined") {
    setSubmitting(true);
    try {
      await fetch("/api/analytics/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch {
      // Treat as declined client-side even if the request failed —
      // never leave the banner stuck open because of a network blip.
    }
    setSubmitting(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-gray bg-brand-surface px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          We&apos;d like to use a cookie to understand how visitors use this site — which pages and courses get
          looked at, nothing that identifies you personally. It&apos;s only on with your OK.{" "}
          <Link href="/privacy-policy" className="font-semibold text-brand-teal underline">
            Learn more
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={() => decide("declined")} disabled={submitting}>
            Decline
          </Button>
          <Button size="sm" onClick={() => decide("accepted")} disabled={submitting}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
