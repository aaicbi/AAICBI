"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Select } from "@/components/ui/Field";
import EventCover from "@/components/events/EventCover";
import EventCalendar from "@/components/events/EventCalendar";
import EventActions from "@/components/events/EventActions";
import EventSettingsPanel from "@/components/events/EventSettingsPanel";
import { StatusBadges, howOf, whenOf, useManagerList, type ManagerData } from "@/components/events/managerShared";
import { AUDIENCES, AUDIENCE_SHORT, DELIVERIES, DELIVERY_LABEL, EVENT_TYPES, eventTypeLabel, PROMOTION_LABEL } from "@/lib/events/eventsCore";
import type { ManagedRow } from "@/lib/events/events";

export type Section = "overview" | "all" | "public" | "scheduled" | "promotions" | "registrations" | "calendar" | "reports" | "settings" | "upcoming" | "internal" | "live";

interface Nav { key: Section; label: string; need?: (p: string[]) => boolean }
const any = (...keys: string[]) => (p: string[]) => keys.some((k) => p.includes(k));
const PLATFORM_NAV: Nav[] = [
  { key: "overview", label: "Event overview" },
  { key: "all", label: "All events", need: any("events.global:view", "events.platform:create", "events.platform:edit", "events.platform:publish") },
  { key: "public", label: "Public events", need: any("events.global:view", "events.platform:publish", "events.promotions:view") },
  { key: "scheduled", label: "Scheduled events", need: any("events.global:view", "events.platform:create", "events.platform:edit") },
  { key: "promotions", label: "Promotion requests", need: any("events.promotions:view") },
  { key: "registrations", label: "Registration and attendance", need: any("events.registrations:view") },
  { key: "calendar", label: "Calendar" },
  { key: "reports", label: "Reports and analytics", need: any("events.analytics:view") },
  { key: "settings", label: "Event settings", need: any("events.settings:configure", "events.categories:manage") },
];
const ORG_NAV: Nav[] = [
  { key: "all", label: "My organisation events" },
  { key: "upcoming", label: "Upcoming events" },
  { key: "internal", label: "Internal meetings" },
  { key: "live", label: "Live training sessions" },
  { key: "promotions", label: "Promotion requests", need: any("org_events.promotion:view") },
  { key: "registrations", label: "Registration and attendance", need: any("org_events.registrations:view") },
  { key: "calendar", label: "Calendar" },
];

const btnPrimary = "inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover";

/** The Event Manager for platform staff and for training organisations: the same screens, scoped by who is signed in. */
export default function EventManager({ scope, apiBase, uiBase, section, permissions }: { scope: "platform" | "organization"; apiBase: string; uiBase: string; section: Section; permissions: string[] }) {
  const nav = (scope === "platform" ? PLATFORM_NAV : ORG_NAV).filter((n) => !n.need || n.need(permissions));
  const canCreate = permissions.includes(scope === "platform" ? "events.platform:create" : "org_events.events:create");
  const active = nav.some((n) => n.key === section) ? section : nav[0]?.key ?? "overview";
  const href = (s: Section) => `${uiBase}?section=${s}`;
  return (
    <div className="space-y-5" data-testid="event-manager">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Event Manager sections" className="flex max-w-full gap-1 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {nav.map((n) => <Link key={n.key} href={href(n.key)} aria-current={active === n.key ? "page" : undefined} className={`flex min-h-[44px] shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${active === n.key ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray text-gray-700 hover:bg-brand-mint/50"}`}>{n.label}</Link>)}
        </nav>
        {canCreate && <Link href={`${uiBase}/new`} className={btnPrimary}>Create event</Link>}
      </div>
      {active === "overview" && <Overview scope={scope} apiBase={apiBase} uiBase={uiBase} />}
      {(active === "all" || active === "public" || active === "scheduled" || active === "upcoming" || active === "internal" || active === "live") && <EventTable key={active} section={active} scope={scope} apiBase={apiBase} uiBase={uiBase} />}
      {active === "promotions" && <PromotionQueue scope={scope} apiBase={apiBase} uiBase={uiBase} permissions={permissions} />}
      {active === "registrations" && <RegistrationsOverview apiBase={apiBase} uiBase={uiBase} />}
      {active === "calendar" && <CalendarSection apiBase={apiBase} uiBase={uiBase} />}
      {active === "reports" && <Reports apiBase={apiBase} />}
      {active === "settings" && <SettingsSection apiBase={apiBase} permissions={permissions} />}
    </div>
  );
}

function Loading<T>({ data, error, reload, children }: { data: T | null; error: string | null; reload: () => void; children: (d: T) => React.ReactNode }) {
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <SkeletonList rows={3} />;
  return <>{children(data)}</>;
}

function Tile({ label, value, tone = "default", href }: { label: string; value: number; tone?: "default" | "alert"; href?: string }) {
  const inner = <Card className={tone === "alert" && value > 0 ? "border-brand-gold" : ""}><p className="text-3xl font-semibold text-brand-ink">{value}</p><p className="text-sm text-gray-700">{label}</p></Card>;
  return href ? <Link href={href} className="block rounded-3xl focus-visible:ring-2 focus-visible:ring-brand-teal">{inner}</Link> : inner;
}

function Row({ e, uiBase, compact = false }: { e: ManagedRow; uiBase: string; compact?: boolean }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-3 sm:flex-nowrap" data-testid="event-row">
      <div className="min-w-0 flex-1">
        <Link href={`${uiBase}/${e.id}`} className="font-semibold text-brand-ink hover:underline [overflow-wrap:anywhere]">{e.title}</Link>
        <p className="text-xs text-gray-600">{e.organizer.name}{e.organizer.promotedByAaicbi ? " (promoted by AAICBI)" : ""} · {whenOf(e)}</p>
        <p className="text-xs text-gray-600">{howOf(e)}</p>
        {!compact && <div className="mt-1"><StatusBadges e={e} /></div>}
      </div>
      {!compact && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-gray-600">
          {e.registrationMode !== "OPEN" && <span>{e.registrationCounts.confirmed}{e.capacity ? `/${e.capacity}` : ""} registered{e.registrationCounts.pending ? ` · ${e.registrationCounts.pending} waiting` : ""}</span>}
          <Link href={`${uiBase}/${e.id}`} className="font-semibold text-brand-teal hover:underline">Open</Link>
        </div>
      )}
    </li>
  );
}

function Overview({ scope, apiBase, uiBase }: { scope: "platform" | "organization"; apiBase: string; uiBase: string }) {
  const up = useManagerList(apiBase, "when=upcoming&take=6");
  const pend = useManagerList(apiBase, scope === "platform" ? "promotion=SUBMITTED&when=all&take=5" : "when=all&take=200");
  return (
    <Loading data={up.data} error={up.error} reload={up.reload}>
      {(d) => {
        const o = d.overview;
        const myPromos = (pend.data?.items ?? []).filter((e) => e.managed && ["SUBMITTED", "CHANGES_REQUESTED", "APPROVED"].includes(e.managed.promotionStatus));
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Upcoming" value={o.upcoming} />
              <Tile label="Live now" value={o.live} />
              <Tile label="Drafts" value={o.drafts} href={`${uiBase}?section=all&status=DRAFT`} />
              <Tile label={scope === "platform" ? "Promotion requests waiting" : "Promotion requests open"} value={o.pendingPromotion} tone="alert" href={`${uiBase}?section=promotions`} />
              <Tile label="Published publicly" value={o.published} />
              <Tile label="Confirmed registrations" value={o.registrations} />
              <Tile label="Finished in the last 30 days" value={o.completed30} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-semibold text-brand-ink">Coming up</h2>
                {d.items.length === 0 ? <p className="mt-2 text-sm text-gray-600">Nothing is scheduled yet.</p> : <ul className="mt-2 divide-y divide-brand-gray">{d.items.map((e) => <Row key={e.id} e={e} uiBase={uiBase} compact />)}</ul>}
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold text-brand-ink">{scope === "platform" ? "Waiting for your decision" : "Your promotion requests"}</h2>
                {(scope === "platform" ? pend.data?.items ?? [] : myPromos).length === 0 ? <p className="mt-2 text-sm text-gray-600">{scope === "platform" ? "No requests are waiting." : "You have no open requests."}</p> : (
                  <ul className="mt-2 divide-y divide-brand-gray">{(scope === "platform" ? pend.data?.items ?? [] : myPromos).map((e) => <li key={e.id} className="p-3"><Link href={`${uiBase}/${e.id}`} className="font-semibold text-brand-ink hover:underline">{e.title}</Link><p className="text-xs text-gray-600">{e.organizer.name} · {e.managed?.promotionLabel}</p></li>)}</ul>
                )}
              </Card>
            </div>
          </div>
        );
      }}
    </Loading>
  );
}

const SECTION_QUERY: Record<string, string> = { all: "when=all", public: "audience=PUBLIC&promotion=PUBLISHED&when=all", scheduled: "status=SCHEDULED&when=upcoming", upcoming: "status=SCHEDULED&when=upcoming", internal: "when=all", live: "when=all" };
const SECTION_TITLE: Record<string, string> = { all: "All events", public: "Public events", scheduled: "Scheduled events", upcoming: "Upcoming events", internal: "Internal meetings", live: "Live training sessions" };
const INTERNAL_AUDIENCES = ["ORG_MEMBERS", "SELECTED_TRAINEES", "ORG_STAFF", "INVITED", "PRIVATE"];
const LIVE_TYPES = ["LIVE_TRAINING", "ONLINE_CLASS", "WEBINAR", "MENTORING", "DEMONSTRATION"];

function EventTable({ section, scope, apiBase, uiBase }: { section: Section; scope: "platform" | "organization"; apiBase: string; uiBase: string }) {
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [audience, setAudience] = useState(""), [delivery, setDelivery] = useState(""), [type, setType] = useState("");
  const query = useMemo(() => { const p = new URLSearchParams(SECTION_QUERY[section] ?? "when=all"); p.set("take", "200"); if (q) p.set("q", q); if (status) p.set("status", status); if (audience) p.set("audience", audience); if (delivery) p.set("delivery", delivery); if (type) p.set("type", type); return p.toString(); }, [section, q, status, audience, delivery, type]);
  const { data, error, reload } = useManagerList(apiBase, query);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-brand-ink">{SECTION_TITLE[section]}</h2>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, place, organiser" compact />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} compact><option value="">Any (not archived)</option><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="CANCELLED">Cancelled</option><option value="ARCHIVED">Archived</option></Select>
          <Select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} compact><option value="">Any</option>{AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_SHORT[a]}</option>)}</Select>
          <Select label="Delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)} compact><option value="">Any</option>{DELIVERIES.map((d) => <option key={d} value={d}>{DELIVERY_LABEL[d]}</option>)}</Select>
          <Select label="Kind" value={type} onChange={(e) => setType(e.target.value)} compact><option value="">Any</option>{EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
        </div>
      </Card>
      <Loading data={data} error={error} reload={reload}>
        {(d) => {
          const items = d.items.filter((e) => (section === "internal" ? INTERNAL_AUDIENCES.includes(e.audience) : section === "live" ? e.delivery !== "PHYSICAL" && LIVE_TYPES.includes(e.eventType) : true));
          return items.length === 0 ? <EmptyState title="No events here" description={scope === "organization" ? "Create an event to schedule a class, a meeting or a public activity." : "Nothing matches these filters."} /> : (
            <ul className="divide-y divide-brand-gray rounded-2xl border border-brand-gray bg-brand-surface">{items.map((e) => <Row key={e.id} e={e} uiBase={uiBase} />)}</ul>
          );
        }}
      </Loading>
    </div>
  );
}

const PROMO_FILTERS = [["SUBMITTED", "Waiting for review"], ["CHANGES_REQUESTED", "Changes requested"], ["APPROVED", "Approved"], ["PUBLISHED", "Published"], ["REJECTED", "Rejected"]] as const;

function completeness(e: ManagedRow): { label: string; ok: boolean }[] {
  return [
    { label: "Short summary", ok: !!e.summary }, { label: "Full description", ok: (e.description ?? "").length >= 40 }, { label: "Flyer", ok: !!e.flyerUrl },
    { label: e.delivery === "ONLINE" ? "Meeting link" : e.delivery === "HYBRID" ? "Venue and meeting link" : "Venue", ok: e.delivery === "ONLINE" ? e.hasJoinInfo : e.delivery === "HYBRID" ? !!e.venueName && e.hasJoinInfo : !!e.venueName },
    { label: "Registration details", ok: e.registrationMode !== "OPEN" ? e.capacity !== null || !!e.registrationNotes || !!e.registrationUrl : true },
  ];
}

function PromotionQueue({ scope, apiBase, uiBase, permissions }: { scope: "platform" | "organization"; apiBase: string; uiBase: string; permissions: string[] }) {
  const [filter, setFilter] = useState<string>(scope === "platform" ? "SUBMITTED" : "");
  const { data, error, reload } = useManagerList(apiBase, `audience=PUBLIC&when=all&take=200${scope === "platform" && filter ? `&promotion=${filter}` : ""}`);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-brand-ink">{scope === "platform" ? "Promotion requests" : "My promotion requests"}</h2>
      <p className="text-sm text-gray-700">{scope === "platform" ? "Organisations ask AAICBI to advertise a public event. Nothing is public until you approve and publish it. The organisation stays the named organiser, and you never see its private meeting link." : "Ask AAICBI to promote a public event. You can still run the event yourself whatever the answer."}</p>
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {scope === "organization" && <button type="button" aria-pressed={filter === ""} onClick={() => setFilter("")} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${filter === "" ? "border-brand-teal bg-brand-mint" : "border-brand-gray"}`}>All</button>}
        {PROMO_FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(filter === k && scope === "organization" ? "" : k)} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${filter === k ? "border-brand-teal bg-brand-mint" : "border-brand-gray"}`}>{l}</button>)}
      </div>
      <Loading data={data} error={error} reload={reload}>
        {(d) => {
          const items = d.items.filter((e) => e.managed && e.managed.promotionStatus !== "NONE" && (scope === "platform" || !filter || e.managed.promotionStatus === filter) && (scope === "platform" ? e.managed.managedBy === "ORG" : true));
          if (items.length === 0) return <EmptyState title="Nothing here" description={scope === "platform" ? "No promotion requests match this filter." : "You have not asked AAICBI to promote any event yet. Open an event and choose Submit for public promotion."} />;
          return (
            <ul className="space-y-4">
              {items.map((e) => (
                <li key={e.id} data-testid="promotion-item"><Card>
                  <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                    <EventCover flyerUrl={e.flyerUrl} title={e.title} eventType={e.eventType} delivery={e.delivery} className="rounded-xl" />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2"><Link href={`${uiBase}/${e.id}`} className="font-display text-lg font-semibold text-brand-ink hover:underline">{e.title}</Link><Badge variant={e.managed?.promotionStatus === "PUBLISHED" ? "gold" : e.managed?.promotionStatus === "REJECTED" ? "danger" : "warning"}>{e.managed ? PROMOTION_LABEL[e.managed.promotionStatus] : ""}</Badge></div>
                      <p className="text-sm text-gray-700">{scope === "platform" && <><b>{e.organizer.name}</b> · </>}{whenOf(e)}</p>
                      <p className="text-sm text-gray-700">{howOf(e)} · {eventTypeLabel(e.eventType)}</p>
                      {e.summary && <p className="line-clamp-2 text-sm text-gray-700">{e.summary}</p>}
                      {scope === "platform" && <ul className="flex flex-wrap gap-2 text-xs">{completeness(e).map((c) => <li key={c.label} className={`rounded-full px-2 py-1 font-semibold ${c.ok ? "bg-brand-mint text-brand-tealDeep" : "bg-brand-goldLight text-brand-goldText"}`}>{c.ok ? "✓" : "!"} {c.label}</li>)}</ul>}
                      {e.managed?.promotionNote && <p className="rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText"><b>Note:</b> {e.managed.promotionNote}</p>}
                      <EventActions event={e} rights={e.rights} scope={scope} apiBase={apiBase} uiBase={uiBase} permissions={permissions} afterChange={reload} />
                    </div>
                  </div>
                </Card></li>
              ))}
            </ul>
          );
        }}
      </Loading>
    </div>
  );
}

function RegistrationsOverview({ apiBase, uiBase }: { apiBase: string; uiBase: string }) {
  const { data, error, reload } = useManagerList(apiBase, "when=all&take=200&status=SCHEDULED");
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-brand-ink">Registration and attendance</h2>
      <Loading data={data} error={error} reload={reload}>
        {(d) => {
          const items = d.items.filter((e) => e.registrationMode !== "OPEN" && e.rights.registrations);
          return items.length === 0 ? <EmptyState title="No events with registration" description="Events that ask people to register appear here with their numbers." /> : (
            <ul className="divide-y divide-brand-gray rounded-2xl border border-brand-gray bg-brand-surface">
              {items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><Link href={`${uiBase}/${e.id}?tab=registrations`} className="font-semibold text-brand-ink hover:underline [overflow-wrap:anywhere]">{e.title}</Link><p className="text-xs text-gray-600">{whenOf(e)}</p></div>
                  <p className="text-sm text-gray-700"><b>{e.registrationCounts.confirmed}</b>{e.capacity ? ` / ${e.capacity}` : ""} confirmed{e.registrationCounts.pending ? ` · ${e.registrationCounts.pending} waiting` : ""}</p>
                </li>
              ))}
            </ul>
          );
        }}
      </Loading>
    </div>
  );
}

function CalendarSection({ apiBase, uiBase }: { apiBase: string; uiBase: string }) {
  const from = useMemo(() => new Date(Date.now() - 90 * 864e5).toISOString(), []);
  const to = useMemo(() => new Date(Date.now() + 300 * 864e5).toISOString(), []);
  const [org, setOrg] = useState(""), [status, setStatus] = useState("");
  const { data, error, reload } = useManagerList(apiBase, `when=all&take=200&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${status ? `&status=${status}` : ""}${org ? `&organizer=${org}` : ""}`);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {apiBase.includes("/admin/") && <Select label="Organiser" value={org} onChange={(e) => setOrg(e.target.value)} compact wrapperClassName="w-56"><option value="">Everyone</option><option value="platform">AAICBI only</option></Select>}
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} compact wrapperClassName="w-48"><option value="">Not archived</option><option value="SCHEDULED">Scheduled</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option></Select>
      </div>
      <Loading data={data} error={error} reload={reload}>
        {(d) => <EventCalendar href={(id) => `${uiBase}/${id}`} events={d.items.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, audience: e.audience, phase: e.phase, status: e.status, organizerName: e.organizer.name, delivery: e.delivery }))} />}
      </Loading>
    </div>
  );
}

function Reports({ apiBase }: { apiBase: string }) {
  const { data, error, reload } = useManagerList(apiBase, "when=all&take=200");
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-brand-ink">Reports and analytics</h2>
      <Loading data={data} error={error} reload={reload}>
        {(d) => {
          const count = <T extends string>(f: (e: ManagedRow) => T) => { const m = new Map<T, number>(); for (const e of d.items) m.set(f(e), (m.get(f(e)) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
          const top = [...d.items].filter((e) => e.registrationCounts.confirmed > 0).sort((a, b) => b.registrationCounts.confirmed - a.registrationCounts.confirmed).slice(0, 8);
          const Block = ({ title, rows }: { title: string; rows: [string, number][] }) => (
            <Card><h3 className="font-semibold text-brand-ink">{title}</h3><ul className="mt-2 space-y-1 text-sm">{rows.map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><b>{v}</b></li>)}</ul></Card>
          );
          return (
            <div className="grid gap-4 md:grid-cols-2">
              <Block title="By delivery" rows={count((e) => DELIVERY_LABEL[e.delivery]) as [string, number][]} />
              <Block title="By audience" rows={count((e) => AUDIENCE_SHORT[e.audience]) as [string, number][]} />
              <Block title="By kind" rows={count((e) => eventTypeLabel(e.eventType)) as [string, number][]} />
              <Block title="Public promotion" rows={count((e) => (e.managed ? PROMOTION_LABEL[e.managed.promotionStatus] : "Not promoted")) as [string, number][]} />
              <Card className="md:col-span-2"><h3 className="font-semibold text-brand-ink">Most registrations</h3>{top.length === 0 ? <p className="mt-2 text-sm text-gray-600">No registrations yet.</p> : <ul className="mt-2 space-y-1 text-sm">{top.map((e) => <li key={e.id} className="flex justify-between gap-3"><span className="[overflow-wrap:anywhere]">{e.title}</span><b>{e.registrationCounts.confirmed}{e.capacity ? ` / ${e.capacity}` : ""}</b></li>)}</ul>}</Card>
              <p className="text-xs text-gray-600 md:col-span-2">Counts cover the {d.items.length} most recent events. Registration numbers are confirmed registrations, not attendance: attendance comes only from the register an organiser keeps.</p>
            </div>
          );
        }}
      </Loading>
    </div>
  );
}

function SettingsSection({ apiBase, permissions }: { apiBase: string; permissions: string[] }) {
  const { data, error, reload } = useManagerList(apiBase, "take=1");
  return <Loading<ManagerData> data={data} error={error} reload={reload}>{(d) => <EventSettingsPanel data={d} canConfigure={permissions.includes("events.settings:configure")} canCategories={permissions.includes("events.categories:manage")} reload={reload} />}</Loading>;
}
