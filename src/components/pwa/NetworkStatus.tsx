"use client";
import { useCallback, useEffect, useState } from "react";

/** Whether the browser believes it has a connection, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/**
 * A slim notice at the top when the connection drops, with a retry button
 * (the browser's own flag can be wrong, so Retry really asks the server),
 * and a short "Back online" when it returns. It never hides the page.
 */
export default function NetworkStatus() {
  const online = useOnline();
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowBack(false);
      return;
    }
    if (wasOffline) {
      setShowBack(true);
      const t = window.setTimeout(() => {
        setShowBack(false);
        setWasOffline(false);
      }, 3000);
      return () => window.clearTimeout(t);
    }
  }, [online, wasOffline]);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      await fetch("/manifest.webmanifest", { cache: "no-store" });
      window.dispatchEvent(new Event("online"));
    } catch {
      /* still offline: the notice stays */
    }
    setChecking(false);
  }, []);

  if (online && !showBack) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-3" style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}>
      <div className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${online ? "bg-brand-teal text-brand-onAccent" : "bg-brand-ink text-brand-sand"}`}>
        <span>{online ? "Back online" : "You're offline. Some pages won't load."}</span>
        {!online && (
          <button type="button" onClick={retry} disabled={checking} className="min-h-[32px] rounded-full bg-brand-sand px-3 text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60">
            {checking ? "Checking…" : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}
