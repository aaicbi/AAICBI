"use client";
import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { promptInstall, useInstallState } from "@/lib/pwa/installStore";
import { installButtonMode, isMobileDevice } from "@/lib/pwa/installCore";

/**
 * A button anyone can press to put the app on their phone's home screen.
 * Where the browser allows it, one tap opens its own install dialog; on
 * iPhone/iPad (which has no such dialog for web pages) and on browsers that
 * withhold it, a short sheet shows the exact steps. Hidden once installed.
 */
export default function AddToHomeScreenButton({ className = "", label = "Add to home screen" }: { className?: string; label?: string }) {
  const { installed, canPrompt, ios } = useInstallState();
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMobile(isMobileDevice(navigator.userAgent, navigator.maxTouchPoints)), []);

  const mode = installButtonMode({ installed, canPrompt, ios, mobile });
  if (mode === "none") return null;

  const press = async () => {
    if (mode === "prompt") {
      const r = await promptInstall();
      if (r === "unavailable") setOpen(true);
    } else setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={press}
        className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-teal px-3 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${className}`}
      >
        <Icon icon={Download} size="sm" /> {label}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add to home screen" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 print:hidden" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-brand-gray bg-brand-surface p-5 text-brand-ink" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Add AAICBI to your home screen</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                <Icon icon={X} size="md" />
              </button>
            </div>
            {ios ? (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                <li>Open this page in <strong>Safari</strong> (other iPhone browsers may not show the option).</li>
                <li>Tap the <Icon icon={Share} size="sm" className="inline" /> <strong>Share</strong> button.</li>
                <li>Scroll and choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                <li>Open this page in <strong>Chrome</strong> (or your phone&apos;s main browser).</li>
                <li>Tap the menu <Icon icon={MoreVertical} size="sm" className="inline" />.</li>
                <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</li>
              </ol>
            )}
            <p className="mt-3 text-xs text-gray-600">An AAICBI icon will appear on your home screen and open the app full-screen.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-brand-gray text-sm font-semibold hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
