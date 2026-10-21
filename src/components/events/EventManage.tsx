"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import EventCover from "@/components/events/EventCover";
import EventActions from "@/components/events/EventActions";
import RegistrationsPanel from "@/components/events/RegistrationsPanel";
import { StatusBadges, howOf, promoVariant, whenOf } from "@/components/events/managerShared";
import { AUDIENCE_LABEL, REGISTRATION_MODE_LABEL, eventTypeLabel, formatWhen } from "@/lib/events/eventsCore";
import type { EventView, Rights } from "@/lib/events/events";

interface Detail { event: EventView; seriesTotal: number | null; seriesLater: number; rights: Rights; join: { meetingUrl: string; meetingId: string | null; instructions: string | null; hasPasscode: boolean } | null; history: { id: string; at: string; who: string; action: string; note: string | null }[] }

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</dt><dd className="mt-0.5 text-sm text-brand-ink [overflow-wrap:anywhere]">{children}</dd></div>;

/** One event, for the people who manage it: its facts, what they can do with it, the participant list and its history. */
export default function EventManage({ scope, apiBase, uiBase, eventId, permissions, initialTab }: { scope: "platform" | "organization"; apiBase: string; uiBase: string; eventId: string; permissions: string[]; initialTab?: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "registrations" | "history">(initialTab === "registrations" ? "registrations" : initialTab === "history" ? "history" : "details");
  const load = useCallback(async () => {
    setError(null);
    const r = await fetch(`${apiBase}/${eventId}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Could not load this event."); else setD(j);
  }, [apiBase, eventId]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!d) return <SkeletonList rows={3} />;
  const e = d.event, r = d.rights;
  const showRegs = r.registrations;
  const started = new Date(e.startsAt).getTime() <= Date.now();
  const tabs: [typeof tab, string][] = [["details", "Details"], ...(showRegs ? [["registrations", "Participants"] as [typeof tab, string]] : []), ["history", "History"]];
  return (
    <div className="space-y-5" data-testid="event-manage">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-2xl font-semibold text-brand-ink [overflow-wrap:anywhere]">{e.title}</h1><StatusBadges e={e} /></div>
        <p className="text-sm text-gray-700">{e.organizer.name}{e.organizer.promotedByAaicbi ? " (promoted by AAICBI on its behalf)" : ""} · {whenOf(e)}</p>
        <EventActions event={e} rights={r} scope={scope} apiBase={apiBase} uiBase={uiBase} permissions={permissions} afterChange={load} seriesLater={d.seriesLater} />
        {e.series && <p className="text-sm text-gray-700" data-testid="series-note">Repeating event: <b>{e.series.index}{d.seriesTotal ? ` of ${d.seriesTotal}` : ""}</b>. It can be edited, cancelled and registered for on its own.</p>}
        {e.published && <p className="text-sm"><Link href={`/events/${e.id}`} className="font-semibold text-brand-teal hover:underline">View the public page</Link></p>}
        {!r.edit && scope === "organization" && e.managed?.managedBy === "PLATFORM" && <p className="rounded-lg bg-brand-mint/50 px-3 py-2 text-sm text-brand-ink">AAICBI manages this event on your behalf. You can see it here but cannot change it.</p>}
        {e.managed?.promotionNote && e.managed.promotionStatus !== "APPROVED" && <p className="rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText"><b>AAICBI note:</b> {e.managed.promotionNote}</p>}
      </div>
      <div role="tablist" aria-label="Event sections" className="flex gap-1 border-b border-brand-gray">
        {tabs.map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[44px] border-b-2 px-4 text-sm font-semibold ${tab === k ? "border-brand-teal text-brand-ink" : "border-transparent text-gray-600"}`}>{l}</button>)}
      </div>
      {tab === "details" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-3"><EventCover flyerUrl={e.flyerUrl} title={e.title} eventType={e.eventType} delivery={e.delivery} className="rounded-2xl" />
            {e.embedUrl && <div className="aspect-video overflow-hidden rounded-xl border border-brand-gray"><iframe src={e.embedUrl} title="Promotional video" className="h-full w-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture" /></div>}
            {e.videoKind === "UPLOAD" && e.videoUrl && <video src={e.videoUrl} controls preload="metadata" className="w-full rounded-xl border border-brand-gray" />}
          </div>
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Kind">{eventTypeLabel(e.eventType)}{e.category ? ` · ${e.category.name}` : ""}</Fact>
              <Fact label="When">{formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone)}</Fact>
              <Fact label="How">{howOf(e)}</Fact>
              {e.address && <Fact label="Address">{[e.address, e.city, e.state].filter(Boolean).join(", ")}</Fact>}
              {e.hasJoinInfo && <Fact label="Online session">{e.conferenceProvider}{d.join ? <> · <a href={d.join.meetingUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand-teal underline">Open the meeting link</a>{d.join.meetingId ? ` · ID ${d.join.meetingId}` : ""}{d.join.hasPasscode ? " · passcode saved" : ""}</> : " · link kept private"}</Fact>}
              <Fact label="Audience">{AUDIENCE_LABEL[e.audience]}{e.managed && e.managed.targets.length > 0 ? ` (${e.managed.targets.length} chosen)` : ""}</Fact>
              <Fact label="Registration">{REGISTRATION_MODE_LABEL[e.registrationMode]}{e.capacity ? ` · capacity ${e.capacity}` : ""}</Fact>
              {e.managed && e.audience === "PUBLIC" && <Fact label="Public promotion"><Badge variant={promoVariant(e.managed.promotionStatus)}>{e.managed.promotionLabel}</Badge></Fact>}
              {e.cancelReason && <Fact label="Cancelled because">{e.cancelReason}</Fact>}
              <Fact label="Created by">{e.managed?.createdByLabel ?? "Unknown"}</Fact>
            </dl>
            {e.description && <div className="mt-4 border-t border-brand-gray pt-3"><p className="whitespace-pre-line text-sm text-gray-800 [overflow-wrap:anywhere]">{e.description}</p></div>}
          </Card>
        </div>
      )}
      {tab === "registrations" && showRegs && <RegistrationsPanel apiBase={apiBase} eventId={e.id} canManage={permissions.includes(scope === "platform" ? "events.registrations:manage" : "org_events.registrations:manage")} canExport={r.exportList} started={started} />}
      {tab === "history" && (
        d.history.length === 0 ? <p className="text-sm text-gray-600">No history yet.</p> : (
          <ol className="space-y-2" data-testid="event-history">
            {d.history.map((h) => <li key={h.id} className="rounded-xl border border-brand-gray bg-brand-surface p-3 text-sm"><p><b className="text-brand-ink">{h.action}</b> · {h.who}</p><p className="text-xs text-gray-600">{new Date(h.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{h.note ? ` · ${h.note}` : ""}</p></li>)}
          </ol>
        )
      )}
    </div>
  );
}
