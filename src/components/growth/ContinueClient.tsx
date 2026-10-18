"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/** Claims the taster for the signed-in trainee and opens module 1. Someone not signed in is offered sign-up or sign-in, both returning here. */
export default function ContinueClient({ slug, courseTitle }: { slug: string; courseTitle: string }) {
  const [state, setState] = useState<"working" | "signin" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);
  const here = `/play/${slug}/continue`;

  useEffect(() => {
    let token: string | null = null;
    try { token = window.localStorage.getItem(`aaicbi.growth.${slug}`); } catch {}
    void (async () => {
      const res = await fetch("/api/growth/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, token }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { window.location.assign(`/trainee/courses/${json.courseId}`); return; }
      if (res.status === 401) { setState("signin"); return; }
      setMessage(json.error ?? "That didn't work. Please try again.");
      setState("error");
    })();
  }, [slug]);

  const box = "rounded-3xl border border-brand-gray/60 bg-card-gradient p-5 shadow-sm sm:p-7";
  if (state === "working") return <section className={box} aria-live="polite"><p className="text-brand-ink">Opening Module 1…</p></section>;
  if (state === "error") return <section className={box}><h1 className="font-display text-2xl font-bold text-brand-ink">We couldn&apos;t open Module 1</h1><p className="mt-2 text-brand-ink" role="alert">{message}</p><Link href={`/play/${slug}`} className="mt-4 flex min-h-[52px] items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action">Back</Link></section>;
  return (
    <section className={box}>
      <h1 className="font-display text-2xl font-bold text-brand-ink [text-wrap:balance]">Start Module 1 of {courseTitle}, free</h1>
      <p className="mt-2 text-brand-ink">Create a free account and Module 1 opens right away. Pass its assessment to see how to continue.</p>
      <Link href={`/trainee/register?next=${encodeURIComponent(here)}`} className="mt-5 flex min-h-[52px] items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="continue-register">Create my free account</Link>
      <Link href={`/trainee/login?next=${encodeURIComponent(here)}`} className="mt-3 flex min-h-[52px] items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint" data-testid="continue-login">I already have an account</Link>
    </section>
  );
}
