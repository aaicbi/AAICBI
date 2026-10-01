"use client";
import { useState } from "react";

/**
 * Analytics System Phase 2 — the withdrawal path the Privacy Policy
 * promises: clears both cookies server-side (via the existing consent
 * route, deletion variant) and dispatches the same custom event
 * CookieConsentBanner listens for, so the banner reappears in this tab
 * immediately without a full page reload.
 */
export default function ManageCookiePreferences() {
  const [done, setDone] = useState(false);

  async function handleClick() {
    try {
      await fetch("/api/analytics/consent", {
        method: "DELETE",
      });
    } catch {
      // Still reopen the banner client-side even if the request failed
      // — worst case, declining again clears it on the next attempt.
    }
    window.dispatchEvent(new Event("aaicbi:reopen-cookie-banner"));
    setDone(true);
  }

  return (
    <button onClick={handleClick} className="text-sm font-semibold text-brand-teal hover:underline">
      {done ? "Cookie preferences reset — see the banner below." : "Manage Cookie Preferences"}
    </button>
  );
}
