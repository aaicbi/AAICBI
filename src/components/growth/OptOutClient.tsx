"use client";
import { useState } from "react";

export default function OptOutClient({ token }: { token: string }) {
  const [state, setState] = useState<"ask" | "busy" | "done" | "bad">("ask");
  async function go() {
    setState("busy");
    const res = await fetch("/api/public/growth/optout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    setState(res.ok ? "done" : "bad");
  }
  return (
    <section className="rounded-3xl border border-brand-gray/60 bg-card-gradient p-5 shadow-sm sm:p-7" aria-live="polite">
      {state === "done" ? (
        <><h1 className="font-display text-2xl font-bold text-brand-ink">You won&apos;t hear from us again</h1><p className="mt-2 text-brand-ink">We have stopped all messages about this course.</p></>
      ) : state === "bad" ? (
        <><h1 className="font-display text-2xl font-bold text-brand-ink">That link isn&apos;t valid</h1><p className="mt-2 text-brand-ink">It may have been mistyped. Reply STOP to any message and we will remove you.</p></>
      ) : (
        <><h1 className="font-display text-2xl font-bold text-brand-ink">Stop messages?</h1><p className="mt-2 text-brand-ink">We will stop contacting you about this course.</p>
          <button type="button" disabled={state === "busy"} onClick={go} className="mt-5 min-h-[52px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="optout">Stop all messages</button></>
      )}
    </section>
  );
}
