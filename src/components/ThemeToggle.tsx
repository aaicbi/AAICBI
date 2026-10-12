"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * The light/dark switch, fixed at the top of every page as a small tab hanging from the top edge, in the middle, where no header has a control. It changes the page at once and remembers the choice in the same
 * `theme` cookie the page reads before it first paints (see the script in app/layout.tsx), so the next page, and the next visit,
 * open in the same theme with no flash. Dark is the default; only a saved "light" opts out.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* the choice still applies to this page */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed left-1/2 top-0 z-[45] flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-b-xl border border-t-0 border-brand-gray bg-brand-surface text-brand-ink shadow-md transition-colors hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal md:h-4 md:w-14 md:rounded-b-lg print:hidden"
    >
      {dark ? <Sun className="h-4 w-4 md:h-3 md:w-3" aria-hidden="true" /> : <Moon className="h-4 w-4 md:h-3 md:w-3" aria-hidden="true" />}
    </button>
  );
}
