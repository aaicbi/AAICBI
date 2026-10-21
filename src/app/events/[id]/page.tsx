import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, ExternalLink, Globe2, MapPin, Video } from "lucide-react";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import BackLink from "@/components/ui/BackLink";
import Badge from "@/components/ui/Badge";
import EventCover from "@/components/events/EventCover";
import EventParticipation from "@/components/events/EventParticipation";
import { getSession } from "@/lib/auth/session";
import { actorOf } from "@/lib/events/eventsAccess";
import { eventDetail } from "@/lib/events/events";
import { AUDIENCE_SHORT, DELIVERY_LABEL, PHASE_LABEL, eventTypeLabel, formatWhen } from "@/lib/events/eventsCore";
import { appUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await eventDetail(params.id, null).catch(() => null);
  if (!d) return { title: "Event" };
  return { title: d.event.title, description: d.event.summary ?? undefined, openGraph: { title: d.event.title, description: d.event.summary ?? undefined, images: d.event.flyerUrl ? [d.event.flyerUrl] : undefined } };
}

/** One event: what, when (always with its time zone), where, how to register, and, for an online session, the join button. The page never contains the meeting link. */
export default async function EventPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const actor = session && (session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR") ? await actorOf(session).catch(() => null) : null;
  const d = await eventDetail(params.id, session, actor);
  if (!d) notFound();
  const e = d.event;
  const slug = e.organizer.slug;
  const manageHref = d.rights?.read ? (actor?.kind === "ORGANIZATION" ? `/admin/organization/events/${e.id}` : `/admin/events/${e.id}`) : null;
  const hasPhysical = e.delivery !== "ONLINE";
  const jsonLd = e.published ? {
    "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.summary ?? undefined, startDate: e.startsAt, endDate: e.endsAt, image: e.flyerUrl ?? undefined,
    eventAttendanceMode: e.delivery === "ONLINE" ? "https://schema.org/OnlineEventAttendanceMode" : e.delivery === "HYBRID" ? "https://schema.org/MixedEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: e.status === "CANCELLED" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    organizer: { "@type": "Organization", name: e.organizer.name }, url: appUrl(`/events/${e.id}`),
    location: e.delivery === "ONLINE" ? { "@type": "VirtualLocation", url: appUrl(`/events/${e.id}`) } : { "@type": "Place", name: e.venueName ?? e.city ?? "Venue", address: [e.address, e.city, e.state].filter(Boolean).join(", ") },
  } : null;
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <BackLink href="/events">All events</BackLink>
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        <article className="mt-3 space-y-5">
          <EventCover flyerUrl={e.flyerUrl} title={e.title} eventType={e.eventType} delivery={e.delivery} className="rounded-3xl" priority wide />
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {e.phase === "LIVE" && <Badge variant="danger">Live now</Badge>}
              {(e.phase === "CANCELLED" || e.phase === "COMPLETED") && <Badge variant={e.phase === "CANCELLED" ? "danger" : "neutral"}>{PHASE_LABEL[e.phase]}</Badge>}
              <Badge>{eventTypeLabel(e.eventType)}</Badge>
              {e.category && <Badge>{e.category.name}</Badge>}
              <Badge>{DELIVERY_LABEL[e.delivery]}</Badge>
              {e.audience !== "PUBLIC" || !e.published ? <Badge variant="warning">{e.audience === "PUBLIC" ? "Internal until published" : AUDIENCE_SHORT[e.audience]}</Badge> : null}
            </div>
            <h1 className="font-display text-3xl font-semibold text-brand-ink [overflow-wrap:anywhere]">{e.title}</h1>
            <p className="text-sm text-gray-700">
              Organised by {slug ? <Link href={`/organizations/${slug}`} className="font-semibold text-brand-teal hover:underline">{e.organizer.name}</Link> : <b>{e.organizer.name}</b>}
              {e.organizer.promotedByAaicbi && " · promoted by AAICBI on its behalf"}
            </p>
            {manageHref && <p className="text-sm"><Link href={manageHref} className="font-semibold text-brand-teal hover:underline">Manage this event</Link></p>}
          </header>
          {e.status === "CANCELLED" && <p role="status" className="rounded-xl border border-brand-rose bg-brand-roseLight px-4 py-3 text-sm text-brand-rose"><b>This event was cancelled.</b>{e.cancelReason ? ` ${e.cancelReason}` : ""}</p>}
          <section className="grid gap-4 rounded-2xl border border-brand-gray bg-brand-surface p-4 sm:grid-cols-2" aria-label="When and where">
            <p className="flex items-start gap-2 text-sm text-brand-ink"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" aria-hidden="true" /><span><b className="block">When</b>{formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone)}<span className="block text-xs text-gray-600">Time zone: {e.timeZone}</span></span></p>
            {hasPhysical && (
              <p className="flex items-start gap-2 text-sm text-brand-ink"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" aria-hidden="true" /><span className="[overflow-wrap:anywhere]"><b className="block">Venue</b>{e.venueName}{e.address && <span className="block">{e.address}</span>}{(e.city || e.state) && <span className="block">{[e.city, e.state].filter(Boolean).join(", ")}</span>}
                {e.mapUrl && <a href={e.mapUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-teal hover:underline">Open the map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}</span></p>
            )}
            {e.delivery !== "PHYSICAL" && <p className="flex items-start gap-2 text-sm text-brand-ink"><Video className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" aria-hidden="true" /><span><b className="block">Online</b>{e.conferenceProvider ?? "Video call"}{e.delivery === "HYBRID" ? " (you can also attend in person)" : ""}</span></p>}
            {e.delivery === "HYBRID" && <p className="flex items-start gap-2 text-sm text-gray-700"><Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" aria-hidden="true" /><span>{e.hybridSeparateRegistration ? "Online and in-person places are registered separately." : "Online and in-person guests join the same event."}</span></p>}
          </section>
          {hasPhysical && (e.directions || e.attendanceNotes) && (
            <section className="space-y-2 text-sm text-gray-800"><h2 className="font-display text-lg font-semibold text-brand-ink">Getting there</h2>{e.directions && <p className="whitespace-pre-line [overflow-wrap:anywhere]">{e.directions}</p>}{e.attendanceNotes && <p className="whitespace-pre-line [overflow-wrap:anywhere]"><b>Please note:</b> {e.attendanceNotes}</p>}</section>
          )}
          <EventParticipation detail={d} loginHref={`/login?next=${encodeURIComponent(`/events/${e.id}`)}`} />
          {(e.summary || e.description) && (
            <section className="space-y-2"><h2 className="font-display text-lg font-semibold text-brand-ink">About this event</h2>{e.summary && <p className="text-base text-gray-800 [overflow-wrap:anywhere]">{e.summary}</p>}{e.description && <p className="whitespace-pre-line text-sm text-gray-800 [overflow-wrap:anywhere]">{e.description}</p>}</section>
          )}
          {(e.embedUrl || (e.videoKind === "UPLOAD" && e.videoUrl)) && (
            <section aria-label="Promotional video" className="space-y-2"><h2 className="font-display text-lg font-semibold text-brand-ink">Watch</h2>
              {e.embedUrl ? <div className="aspect-video overflow-hidden rounded-2xl border border-brand-gray"><iframe src={e.embedUrl} title={`Video for ${e.title}`} className="h-full w-full" loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /></div>
                : <video src={e.videoUrl ?? undefined} controls preload="metadata" className="w-full rounded-2xl border border-brand-gray" />}
            </section>
          )}
          {e.media.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{e.media.filter((m) => m.kind !== "VIDEO").map((m) => <li key={m.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.url} alt={m.caption ?? ""} loading="lazy" className="aspect-video w-full rounded-xl border border-brand-gray object-cover" /></li>)}</ul>}
        </article>
      </main>
    </>
  );
}
