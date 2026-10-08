"use client";
import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/**
 * A gentle note on pages that are really laptop work: building courses,
 * writing exams, bulk uploads, detailed analytics. It appears only on small
 * screens, never blocks anything, and offers "Copy link" (or the phone's
 * share sheet) to carry on later on a bigger screen. "Continue here" hides
 * it for the rest of the visit. Phones see it on all of these pages;
 * `below="lg"` also shows it on tablets for the most demanding ones.
 */
export default function DesktopRecommended({ what, below = "sm" }: { what: string; below?: "sm" | "lg" }) {
  const [show, setShow] = useState(false);
  const { showToast } = useToast();
  const key = typeof window === "undefined" ? "" : `desktop-note:${location.pathname}`;

  useEffect(() => {
    const small = window.matchMedia(below === "lg" ? "(max-width: 1023px)" : "(max-width: 639px)");
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(key) === "1";
    } catch {
      /* private mode: shown each time */
    }
    const sync = () => setShow(small.matches && !dismissed);
    sync();
    small.addEventListener("change", sync);
    return () => small.removeEventListener("change", sync);
  }, [below, key]);

  if (!show) return null;

  async function copy() {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied. Open it on a laptop or desktop.", "success");
    } catch {
      showToast("Could not copy the link. Select the address bar and copy it.", "error");
    }
  }

  return (
    <aside role="note" aria-label="Larger screen recommended" className="mb-4 rounded-xl border border-brand-gold bg-brand-goldLight p-4 text-brand-ink">
      <div className="flex items-start gap-3">
        <Icon icon={Monitor} size="md" className="mt-0.5 shrink-0 text-brand-goldText" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{what} is optimized for a larger screen.</p>
          <p className="mt-1 text-sm">Please continue on a laptop or desktop for the best experience. You can still look around here.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
              Copy link
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem(key, "1");
                } catch {
                  /* nothing to remember it in */
                }
                setShow(false);
              }}
              className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-brand-ink underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              Continue here
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
