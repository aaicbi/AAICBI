"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";

interface Preview { state: "ok" | "expired" | "revoked" | "used_up"; message: string | null; kind: string; kindLabel: string; role: "EDITOR" | "COPY"; title: string | null; sharedBy: string }

/** Where a share link lands: what is being shared and by whom, then "Join" for a signed-in staff member, instructor or organization. */
export default function CollaboratePage({ params }: { params: { token: string } }) {
  const [p, setP] = useState<Preview | null | "invalid">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    fetch(`/api/collab/preview?token=${encodeURIComponent(params.token)}`).then(async (r) => setP(r.ok ? await r.json() : "invalid")).catch(() => setP("invalid"));
  }, [params.token]);

  async function join() {
    setBusy(true); setError(null);
    const r = await fetch("/api/collab/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) return setNeedsSignIn(true);
    if (!r.ok) return setError(d.error ?? "Could not join.");
    window.location.href = d.href;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      {p === null ? <SkeletonList rows={2} /> : p === "invalid" ? (
        <Card><h1 className="font-display text-xl font-semibold text-brand-ink">This link is not valid</h1><p className="mt-2 text-sm text-gray-700">It may have been mistyped or cancelled. Ask the person who shared it for a new link.</p></Card>
      ) : p.state !== "ok" ? (
        <Card><h1 className="font-display text-xl font-semibold text-brand-ink">This link no longer works</h1><p className="mt-2 text-sm text-gray-700">{p.message}</p></Card>
      ) : (
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-tealDeep">{p.role === "COPY" ? "A course to take a copy of" : "An invitation to edit"}</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-brand-ink">{p.title ?? `A ${p.kindLabel}`}</h1>
          <p className="mt-2 text-sm text-gray-700">{p.sharedBy} {p.role === "COPY" ? `shared this ${p.kindLabel} so you can have your own copy to run.` : `invited you to help build this ${p.kindLabel}. You will be an editor: you can change the content; publishing, pricing and deleting stay with the owner.`}</p>
          {error && <p className="mt-3 text-sm text-brand-rose" role="alert">{error}</p>}
          {needsSignIn && (
            <div className="mt-3 rounded-xl border border-brand-gray p-3 text-sm text-gray-700">
              <p className="font-semibold text-brand-ink">Sign in first, then open this link again.</p>
              <p className="mt-1">Training organizations sign in <Link href="/org/login" className="font-semibold text-brand-teal underline">here</Link>. Instructors and AAICBI staff use their own sign-in address.</p>
            </div>
          )}
          <div className="mt-4"><Button type="button" loading={busy} onClick={join}>{p.role === "COPY" ? "Make my copy" : "Join and open"}</Button></div>
        </Card>
      )}
    </main>
  );
}
