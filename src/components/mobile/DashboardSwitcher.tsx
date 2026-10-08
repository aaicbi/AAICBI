"use client";
import { useEffect, useState } from "react";

const KEY = "dashboard-full-v1";

/**
 * On a phone or tablet the dashboard opens as the short home screen
 * (`mobile`); "Show full dashboard" swaps in the whole page (`children`) for
 * this visit, and "Back to simple view" returns. From laptop width up the
 * full dashboard is always shown and the simple one never appears. Both are
 * rendered by the server; this only chooses which to display.
 */
export default function DashboardSwitcher({ mobile, children }: { mobile: React.ReactNode; children: React.ReactNode }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    try {
      setFull(sessionStorage.getItem(KEY) === "1");
    } catch {
      /* private mode: always starts simple */
    }
  }, []);
  const choose = (v: boolean) => {
    setFull(v);
    try {
      sessionStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* nothing to remember it in */
    }
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      <div className={full ? "hidden" : "lg:hidden"}>
        {mobile}
        <div className="mx-auto max-w-xl px-4 pb-6">
          <button type="button" onClick={() => choose(true)} className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-brand-gray text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            Show full dashboard
          </button>
        </div>
      </div>
      <div className={full ? "" : "hidden lg:block"}>
        {full && (
          <div className="px-4 pt-3 lg:hidden">
            <button type="button" onClick={() => choose(false)} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              Back to simple view
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
