"use client";
import Link from "next/link";
import { useSocial } from "@/components/posts/SocialProvider";

/** The "write a post" prompts: a box at the top of the feed (large screens) and a round button on phones. A visitor is asked to create an account first. */
export function ComposeBox({ initial }: { initial: string }) {
  const { signedIn, gate } = useSocial();
  const cls = "hidden w-full items-center gap-3 rounded-3xl border border-brand-gray bg-brand-surface p-3 text-left shadow-sm hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal lg:flex";
  const inner = (<><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal font-bold text-brand-onAccent" aria-hidden="true">{initial}</span><span className="flex-1 rounded-full border border-brand-gray px-4 py-2.5 text-sm text-gray-600">Share something you learned or built</span></>);
  return signedIn ? <Link href="/compose" className={cls}>{inner}</Link> : <button type="button" className={cls} onClick={() => gate("/compose")}>{inner}</button>;
}

export function ComposeFab() {
  const { signedIn, gate } = useSocial();
  const cls = "fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-brand-onAccent shadow-lg shadow-brand-teal/30 hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal lg:hidden";
  const icon = <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
  return signedIn ? <Link href="/compose" aria-label="Write a post" className={cls}>{icon}</Link> : <button type="button" aria-label="Write a post" className={cls} onClick={() => gate("/compose")}>{icon}</button>;
}
