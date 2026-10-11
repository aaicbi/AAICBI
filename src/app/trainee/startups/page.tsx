"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Mine { id: string; name: string; tagline: string | null; status: string; verified: boolean; handle: string | null; role: string; reviewNote: string | null }
interface Invite { memberId: string; startupName: string; tagline: string | null; title: string | null }
const STATUS: Record<string, ["neutral" | "warning" | "success" | "danger", string]> = { DRAFT: ["neutral", "Draft, only your team sees it"], PENDING: ["warning", "With a reviewer"], APPROVED: ["success", "Public"], REJECTED: ["danger", "Not approved"], SUSPENDED: ["danger", "Suspended"] };

/** My startups: the ones I am on, invitations waiting for my answer, and a way to found a new one. */
export default function MyStartupsPage() {
  const [data, setData] = useState<{ startups: Mine[]; invitations: Invite[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    fetch("/api/startups/mine").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => { setData(d); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    const res = await fetch("/api/startups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error ?? "Could not create the startup.");
    window.location.href = `/trainee/startups/${d.id}`;
  }

  async function answer(memberId: string, accept: boolean) {
    setBusy(memberId);
    const res = await fetch(`/api/startups/invitations/${memberId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept }) });
    setBusy(null);
    if (!res.ok) return showToast("That did not work.", "error");
    showToast(accept ? "You joined the team." : "Invitation declined.", "success");
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">My startups</h1>
      <p className="mt-1 text-sm text-gray-700">Found a startup, build its profile with your team, then send it for review. It becomes public once a super admin approves it.</p>

      {failed ? <div className="mt-6"><ErrorState message="Could not load your startups." onRetry={load} /></div> : !data ? <div className="mt-6"><SkeletonList rows={2} /></div> : (
        <>
          {data.invitations.length > 0 && (
            <section className="mt-6 space-y-3" aria-label="Invitations">
              <h2 className="font-display text-lg font-semibold text-brand-ink">Invitations</h2>
              {data.invitations.map((i) => (
                <Card key={i.memberId} variant="highlighted">
                  <p className="font-semibold text-brand-ink">{i.startupName}</p>
                  <p className="text-sm text-gray-700">{i.tagline ?? "You were invited to join this team."}{i.title ? ` Role: ${i.title}.` : ""}</p>
                  <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="secondary" disabled={busy === i.memberId} onClick={() => answer(i.memberId, false)}>Decline</Button><Button size="sm" loading={busy === i.memberId} onClick={() => answer(i.memberId, true)}>Join the team</Button></div>
                </Card>
              ))}
            </section>
          )}

          <section className="mt-6 space-y-3" aria-label="Your startups">
            {data.startups.length === 0 ? <EmptyState title="No startups yet" description="Found one below, or accept an invitation from a founder." /> : data.startups.map((s) => (
              <Link key={s.id} href={`/trainee/startups/${s.id}`} className="block">
                <Card interactive>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold text-brand-ink">{s.name}</p><Badge variant={STATUS[s.status]?.[0] ?? "neutral"}>{STATUS[s.status]?.[1] ?? s.status}</Badge>{s.verified && <Badge variant="success">Verified</Badge>}<Badge variant="neutral">{s.role === "FOUNDER" ? "Founder" : "Team member"}</Badge></div>
                  {s.tagline && <p className="mt-1 text-sm text-gray-700">{s.tagline}</p>}
                  {s.status === "REJECTED" && s.reviewNote && <p className="mt-2 text-sm text-brand-rose">Reviewer: {s.reviewNote}</p>}
                  {s.handle && <p className="mt-1 text-xs text-gray-600">@{s.handle}</p>}
                </Card>
              </Link>
            ))}
          </section>

          <Card className="mt-8">
            <h2 className="font-display text-lg font-semibold text-brand-ink">Found a new startup</h2>
            <form onSubmit={create} className="mt-3 space-y-3">
              <Input label="Startup name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={error} hint="You can add everything else on the next page." />
              <div className="flex justify-end"><Button type="submit" size="sm" loading={busy === "create"} disabled={name.trim().length < 2}>Create startup</Button></div>
            </form>
          </Card>
        </>
      )}
    </main>
  );
}
