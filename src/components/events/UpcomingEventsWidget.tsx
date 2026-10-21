import Link from "next/link";
import { CalendarDays } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getSession } from "@/lib/auth/session";
import { actorOf, getEventSettings, opensManager } from "@/lib/events/eventsAccess";
import { listManagedEvents, listVisibleEvents, overview } from "@/lib/events/events";
import { formatWhen } from "@/lib/events/eventsCore";

type Item = { id: string; title: string; startsAt: string; endsAt: string; timeZone: string; sub: string; badge?: { text: string; variant: "success" | "warning" | "neutral" } };

/**
 * "Upcoming events" for a dashboard. A trainee, employer or investor sees events meant for them (public ones, their organisation's and course's);
 * an organisation sees its own schedule and the state of its promotion requests; AAICBI staff see the global picture and what waits for a decision.
 * Never shows private events or joining links to anyone else. Draws nothing if the Event Manager is off.
 */
export default async function UpcomingEventsWidget({ as }: { as: "participant" | "organization" | "platform" }) {
  const settings = await getEventSettings();
  if (!settings.enabled) return null;
  const session = await getSession();
  const actor = session ? await actorOf(session).catch(() => null) : null;
  let items: Item[] = [];
  let manage: { href: string; label: string } | null = null;
  const facts: { label: string; value: number; href?: string }[] = [];
  if (as === "participant") {
    const list = await listVisibleEvents(session, { take: 4, when: "upcoming" }).catch(() => null);
    items = (list?.items ?? []).map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, sub: e.organizer.name, badge: e.myRegistration === "CONFIRMED" ? { text: "Registered", variant: "success" } : e.myRegistration === "PENDING" ? { text: "Pending", variant: "warning" } : undefined }));
  } else if (actor && opensManager(actor.permissions, as === "organization" ? "organization" : "platform") && (as === "organization") === (actor.kind === "ORGANIZATION")) {
    const [list, o] = await Promise.all([listManagedEvents(actor, { take: 4, when: "upcoming", status: "SCHEDULED" }).catch(() => null), overview(actor).catch(() => null)]);
    const base = as === "organization" ? "/admin/organization/events" : "/admin/events";
    items = (list?.items ?? []).map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, sub: e.organizer.name, badge: e.managed && e.managed.promotionStatus !== "NONE" && e.audience === "PUBLIC" ? { text: e.managed.promotionLabel, variant: e.managed.promotionStatus === "PUBLISHED" ? "success" : "warning" } : undefined }));
    manage = { href: base, label: as === "organization" ? "Open the Event Manager" : "Open the Event Manager" };
    if (o) { facts.push({ label: "upcoming", value: o.upcoming }, { label: as === "platform" ? "waiting for your decision" : "promotion requests open", value: o.pendingPromotion, href: `${base}?section=promotions` }, { label: "drafts", value: o.drafts }); }
  } else return null;
  const href = (id: string) => (manage ? `${manage.href}/${id}` : `/events/${id}`);
  return (
    <Card className="mt-6" data-testid="upcoming-events-widget">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-ink"><CalendarDays className="h-5 w-5 text-brand-teal" aria-hidden="true" /> Upcoming events</h2>
        <Link href={manage?.href ?? "/events"} className="text-sm font-semibold text-brand-teal hover:underline">{manage?.label ?? "All events"}</Link>
      </div>
      {facts.length > 0 && <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-gray-700">{facts.map((f) => f.href && f.value > 0 ? <Link key={f.label} href={f.href} className="font-semibold text-brand-teal hover:underline"><b>{f.value}</b> {f.label}</Link> : <span key={f.label}><b>{f.value}</b> {f.label}</span>)}</p>}
      {items.length === 0 ? <p className="mt-3 text-sm text-gray-600">{manage ? "Nothing is scheduled yet." : "No upcoming events right now."}</p> : (
        <ul className="mt-3 divide-y divide-brand-gray">
          {items.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0"><Link href={href(e.id)} className="font-semibold text-brand-ink hover:underline [overflow-wrap:anywhere]">{e.title}</Link><p className="text-xs text-gray-600">{formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone)} · {e.sub}</p></div>
              {e.badge && <Badge variant={e.badge.variant}>{e.badge.text}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
