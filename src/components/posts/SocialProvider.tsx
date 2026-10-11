"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Social {
  signedIn: boolean;
  /** True when the person may go ahead. When not, opens the "create an account" prompt that brings them back to `returnTo`. */
  gate: (returnTo?: string) => boolean;
  /** Runs an API call; a 401 opens the same prompt. Returns the response, or null when it opened the prompt. */
  act: (url: string, init?: RequestInit, returnTo?: string) => Promise<Response | null>;
}

const Ctx = createContext<Social>({ signedIn: false, gate: () => false, act: async () => null });
export const useSocial = () => useContext(Ctx);

/**
 * Lets visitors read the feed and asks them to create an account only when
 * they try to take part (react, comment, follow, save, report, write). The
 * prompt remembers where they were, so signing in or registering brings
 * them straight back to the same post.
 */
export default function SocialProvider({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const { showToast } = useToast();

  const here = () => (typeof window === "undefined" ? "/feed" : window.location.pathname + window.location.search);
  const gate = useCallback((returnTo?: string) => {
    if (signedIn) return true;
    setOpen(returnTo ?? here());
    return false;
  }, [signedIn]);

  const act = useCallback(async (url: string, init?: RequestInit, returnTo?: string) => {
    if (!signedIn) { setOpen(returnTo ?? here()); return null; }
    const res = await fetch(url, init);
    if (res.status === 401) { setOpen(returnTo ?? here()); return null; }
    if (!res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      showToast(d.error ?? "That did not work.", "error");
    }
    return res;
  }, [signedIn, showToast]);

  const value = useMemo(() => ({ signedIn, gate, act }), [signedIn, gate, act]);
  const next = open ? encodeURIComponent(open) : "";

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={open !== null} onClose={() => setOpen(null)} title="Join AAICBI to take part" size="sm">
        <p className="text-sm text-gray-700">You can read everything here without an account. To react, comment, follow, save or post, create a free account. We will bring you back to where you were.</p>
        <div className="mt-4 grid gap-2">
          <Link href={`/trainee/register?next=${next}`} className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">Create a free account</Link>
          <Link href={`/trainee/login?next=${next}`} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-brand-teal px-5 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">I already have an account</Link>
        </div>
        <p className="mt-3 text-xs text-gray-600">Employers and investors: <Link href="/employer/login" className="font-semibold text-brand-teal hover:underline">employer sign in</Link> · <Link href="/investor/login" className="font-semibold text-brand-teal hover:underline">investor sign in</Link></p>
      </Modal>
    </Ctx.Provider>
  );
}
