import Link from "next/link";
import { CalendarClock, Globe2, MapPin, Video } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EventCover from "@/components/events/EventCover";
import { DELIVERY_LABEL, PHASE_LABEL, formatWhen, type Delivery, type Phase, type RegistrationMode, type RegistrationStatus } from "@/lib/events/eventsCore";

/** What the card needs. Both the full event view and the short card from the public lists satisfy it. */
export interface CardEvent {
  id: string; title: string; summary: string | null; description?: string | null; eventType: string; startsAt: string; endsAt: string; timeZone: string; delivery: Delivery;
  venueName: string | null; city: string | null; flyerUrl: string | null; phase: Phase; registrationMode: RegistrationMode; capacity: number | null; confirmedCount: number | null;
  organizer: { kind: "AAICBI" | "ORGANIZATION"; name: string; promotedByAaicbi?: boolean };
  category?: { name: string } | null;
}

const registrationText = (e: CardEvent, mine?: RegistrationStatus | null): { text: string; variant: "success" | "warning" | "neutral" } | null => {
  if (mine === "CONFIRMED") return { text: "You are registered", variant: "success" };
  if (mine === "PENDING") return { text: "Registration pending", variant: "warning" };
  if (e.registrationMode === "OPEN") return { text: "Open to attend", variant: "neutral" };
  if (e.registrationMode === "INVITE_ONLY") return { text: "Invited guests", variant: "neutral" };
  if (e.capacity !== null && e.confirmedCount !== null && e.confirmedCount >= e.capacity) return { text: "Full", variant: "warning" };
  if (e.capacity !== null && e.confirmedCount !== null) return { text: `${e.capacity - e.confirmedCount} places left`, variant: "neutral" };
  return { text: e.registrationMode === "APPROVAL" ? "Register (needs approval)" : "Registration open", variant: "neutral" };
};

/** An event as a card: flyer, title, organiser, time with its zone, where, and whether you can register. The whole card opens the event. */
export default function EventCard({ event: e, href, mine, priority = false, compact = false }: { event: CardEvent; href?: string; mine?: RegistrationStatus | null; priority?: boolean; compact?: boolean }) {
  const link = href ?? `/events/${e.id}`;
  const place = e.delivery === "ONLINE" ? "Online" : [e.venueName, e.city].filter(Boolean).join(", ") || DELIVERY_LABEL[e.delivery];
  const Icon = e.delivery === "ONLINE" ? Video : e.delivery === "HYBRID" ? Globe2 : MapPin;
  const reg = registrationText(e, mine);
  const live = e.phase === "LIVE";
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-brand-gray bg-brand-surface shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-brand-teal hover:shadow-md" data-testid="event-card" data-event-id={e.id}>
      {!compact && <EventCover flyerUrl={e.flyerUrl} title={e.title} eventType={e.eventType} delivery={e.delivery} priority={priority} />}
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {live && <Badge variant="danger">Live now</Badge>}
          {e.phase === "CANCELLED" && <Badge variant="danger">{PHASE_LABEL.CANCELLED}</Badge>}
          {e.phase === "COMPLETED" && <Badge>{PHASE_LABEL.COMPLETED}</Badge>}
          {e.category && <Badge>{e.category.name}</Badge>}
          <span className="text-xs font-semibold text-gray-600">{DELIVERY_LABEL[e.delivery]}</span>
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-brand-ink [overflow-wrap:anywhere]">
          <Link href={link} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">{e.title}</Link>
        </h3>
        <p className="text-xs text-gray-600">
          {e.organizer.name}{e.organizer.promotedByAaicbi ? " (promoted by AAICBI)" : ""}
        </p>
        <p className="flex items-start gap-2 text-sm text-brand-ink"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" /><span>{formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone)}</span></p>
        <p className="flex items-start gap-2 text-sm text-gray-700"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" aria-hidden="true" /><span className="[overflow-wrap:anywhere]">{place}</span></p>
        {!compact && e.summary && <p className="line-clamp-2 text-sm text-gray-700">{e.summary}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {reg ? <Badge variant={reg.variant}>{reg.text}</Badge> : <span />}
          <span className="relative z-10 text-sm font-semibold text-brand-teal group-hover:underline">View details</span>
        </div>
      </div>
    </article>
  );
}
