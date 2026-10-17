"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top that appears the instant a link to another page is pressed and goes away when the new page arrives.
 * Pages that load from the server take a moment; without this nothing seems to happen, so people press again. Works on every
 * page without each one needing its own loading screen.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      window.clearTimeout(timer.current);
      setState("loading");
      // Never leave it stuck if the navigation is cancelled or fails.
      timer.current = window.setTimeout(() => setState("idle"), 15000);
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); window.clearTimeout(timer.current); };
  }, []);

  // The new page arrived.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = window.setTimeout(() => setState((s) => (s === "done" ? "idle" : s)), 300);
    return () => window.clearTimeout(t);
  }, [pathname, search]);

  if (state === "idle") return null;
  return (
    <div role="progressbar" aria-label="Loading page" aria-busy={state === "loading"} className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 bg-transparent">
      <div className={`nav-progress-bar h-full bg-brand-teal ${state === "loading" ? "w-[85%] transition-[width] duration-[8000ms] ease-out" : "w-full opacity-0 transition-[width,opacity] duration-300"}`} />
    </div>
  );
}
