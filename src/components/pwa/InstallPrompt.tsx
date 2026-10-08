"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { useInstallState, promptInstall } from "@/lib/pwa/installStore";
import { INSTALL_STORE_KEY, installPromptHidden, parseInstallMemory, shouldOfferInstall, type InstallMemory } from "@/lib/pwa/installCore";

const SESSION_KEY = "pwa-install-visit";

function read(): InstallMemory {
  try {
    return parseInstallMemory(localStorage.getItem(INSTALL_STORE_KEY));
  } catch {
    return { visits: 0, dismissedAt: null };
  }
}
function write(m: InstallMemory) {
  try {
    localStorage.setItem(INSTALL_STORE_KEY, JSON.stringify(m));
  } catch {
    /* private mode: the offer may appear again, which is fine */
  }
}

/**
 * An unobtrusive "Install the app" card at the top of the screen, offered
 * only to someone who has come back at least once, never while a live exam is
 * open, and not again for a month after "Not now". On iPhone and iPad, which
 * have no install button for web pages, it explains Share → Add to Home Screen.
 */
export default function InstallPrompt() {
  const pathname = usePathname() ?? "/";
  const { installed, canPrompt, ios } = useInstallState();
  const [memory, setMemory] = useState<InstallMemory | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  // Count this visit once per browsing session.
  useEffect(() => {
    const m = read();
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        m.visits += 1;
        write(m);
      }
    } catch {
      /* no session storage: counted every load */
    }
    setMemory(m);
  }, []);

  if (!memory || installPromptHidden(pathname) || !shouldOfferInstall(memory, Date.now(), { installed, canPrompt, ios })) return null;

  const dismiss = () => {
    const next = { ...memory, dismissedAt: Date.now() };
    write(next);
    setMemory(next);
  };

  return (
    <div role="region" aria-label="Install the app" className="fixed inset-x-0 z-[80] flex justify-center px-3 print:hidden" style={{ top: "max(env(safe-area-inset-top), 0.75rem)" }}>
      <div className="w-full max-w-md rounded-2xl border border-brand-gray bg-brand-surface p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app icon, a fixed local file. */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold text-brand-ink">Install the app</p>
            <p className="mt-0.5 text-sm text-gray-700">Add AAICBI to your home screen for faster access to your messages, events and learning.</p>
            {showSteps && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-brand-ink">
                <li>Tap the <Icon icon={Share} size="sm" className="inline" /> <strong>Share</strong> button in Safari.</li>
                <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              </ol>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {canPrompt ? (
                <button type="button" onClick={async () => { const r = await promptInstall(); if (r === "dismissed") dismiss(); }} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
                  <Icon icon={Download} size="sm" /> Install
                </button>
              ) : (
                <button type="button" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps} className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
                  {showSteps ? "Hide steps" : "How to add it"}
                </button>
              )}
              <button type="button" onClick={dismiss} className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-gray-700 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                Not now
              </button>
            </div>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            <Icon icon={X} size="md" />
          </button>
        </div>
      </div>
    </div>
  );
}
