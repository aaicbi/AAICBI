import { CalendarDays, Globe2, MapPin, Video } from "lucide-react";
import { DELIVERY_LABEL, eventTypeLabel, type Delivery } from "@/lib/events/eventsCore";

/**
 * The picture at the top of an event card: the organiser's flyer when there is one, otherwise a designed default cover in the platform's
 * colours (so an event without a flyer still looks finished). The flyer is shown whole (never cropped away from its text) on a quiet backdrop.
 */
export default function EventCover({ flyerUrl, title, eventType, delivery, className = "", priority = false, wide = false }: { flyerUrl: string | null; title: string; eventType: string; delivery: Delivery; className?: string; priority?: boolean; wide?: boolean }) {
  const Icon = delivery === "ONLINE" ? Video : delivery === "HYBRID" ? Globe2 : MapPin;
  return (
    <div className={`relative w-full overflow-hidden bg-brand-mint ${flyerUrl || !wide ? "aspect-[16/9]" : "aspect-[3/1]"} ${className}`} data-testid="event-cover">
      {flyerUrl ? (
        <>
          {/* A blurred copy fills the frame so a tall poster does not leave bare bars; the flyer itself is shown whole. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyerUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" loading={priority ? "eager" : "lazy"} decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyerUrl} alt={`Flyer for ${title}`} className="relative h-full w-full object-contain" loading={priority ? "eager" : "lazy"} decoding="async" />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-br from-brand-tealDeep via-brand-teal to-brand-green p-4 text-white" aria-hidden="true">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">{eventTypeLabel(eventType)}</span>
            <Icon className="h-5 w-5 opacity-90" aria-hidden="true" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <CalendarDays className="h-12 w-12 shrink-0 opacity-90" aria-hidden="true" />
            <span className="text-right text-xs font-semibold opacity-90">{DELIVERY_LABEL[delivery]} event</span>
          </div>
        </div>
      )}
    </div>
  );
}
