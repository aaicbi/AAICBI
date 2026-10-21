"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { dayKey, formatDay, monthGrid, phaseOf, weekDays, type Audience, type Phase } from "@/lib/events/eventsCore";

export interface CalendarEvent { id: string; title: string; startsAt: string; endsAt: string; timeZone: string; audience: Audience; phase: Phase; status: "DRAFT" | "SCHEDULED" | "CANCELLED" | "ARCHIVED"; organizerName: string; delivery: string }
type View = "month" | "week" | "day";

const colour = (e: CalendarEvent) => (e.phase === "CANCELLED" ? "bg-brand-roseLight text-brand-rose line-through" : e.phase === "DRAFT" ? "border border-dashed border-brand-gold bg-brand-goldLight text-brand-goldText" : e.audience === "PUBLIC" ? "bg-brand-teal text-brand-onAccent" : "bg-brand-mint text-brand-ink");
const time = (e: CalendarEvent) => new Intl.DateTimeFormat("en-GB", { timeZone: e.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e.startsAt));

/**
 * A month, week or day of events. Public events are solid teal, internal ones soft green, drafts dashed, cancelled ones struck through, so the
 * difference is visible without reading. Every time is shown in the event's own zone. Each event opens its page.
 */
export default function EventCalendar({ events, href, zone = "Africa/Lagos" }: { events: CalendarEvent[]; href: (id: string) => string; zone?: string }) {
  const [view, setView] = useState<View>("month");
  const todayKey = dayKey(new Date(), zone);
  const [anchor, setAnchor] = useState(todayKey);
  const [y, m] = [Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1];
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const s = new Date(e.startsAt), en = new Date(e.endsAt);
      // An event spanning days shows on each day.
      for (let d = new Date(s); d <= en && map.size < 5000; d = new Date(d.getTime() + 864e5)) {
        const k = dayKey(d, e.timeZone);
        map.set(k, [...(map.get(k) ?? []), e]);
        if (dayKey(en, e.timeZone) === k) break;
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

  const move = (dir: -1 | 1) => {
    const t = new Date(`${anchor}T12:00:00Z`);
    if (view === "month") t.setUTCMonth(t.getUTCMonth() + dir, 1); else t.setUTCDate(t.getUTCDate() + dir * (view === "week" ? 7 : 1));
    setAnchor(t.toISOString().slice(0, 10));
  };
  const title = view === "month" ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1))) : view === "week" ? `Week of ${formatDay(new Date(`${weekDays(anchor)[0]}T12:00:00Z`), "UTC")}` : formatDay(new Date(`${anchor}T12:00:00Z`), "UTC");
  const chip = (e: CalendarEvent) => (
    <Link key={e.id} href={href(e.id)} className={`block truncate rounded px-1.5 py-1 text-xs font-semibold ${colour(e)}`} title={`${e.title} (${e.organizerName})`}>{time(e)} {e.title}</Link>
  );

  return (
    <div data-testid="event-calendar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" aria-label="Previous" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAnchor(todayKey)}>Today</Button>
          <Button type="button" size="sm" variant="secondary" aria-label="Next" onClick={() => move(1)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
          <h2 className="ml-2 font-display text-lg font-semibold text-brand-ink" aria-live="polite">{title}</h2>
        </div>
        <div role="group" aria-label="Calendar view" className="flex gap-1">
          {(["month", "week", "day"] as View[]).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold capitalize ${view === v ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray text-gray-700"}`}>{v}</button>)}
        </div>
      </div>
      <p className="mb-2 flex flex-wrap gap-3 text-xs text-gray-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-teal align-middle" />Public</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-mint align-middle" />Internal</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-brand-gold align-middle" />Draft</span><span>Struck through: cancelled</span></p>

      {view === "month" && (
        <>
          <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-brand-gray bg-brand-gray sm:grid" role="grid" aria-label={title}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} role="columnheader" className="bg-brand-mint/50 px-2 py-1 text-center text-xs font-semibold text-brand-ink">{d}</div>)}
            {monthGrid(y, m).flat().map((c) => {
              const list = byDay.get(c.key) ?? [];
              return (
                <div key={c.key} role="gridcell" className={`min-h-[96px] space-y-1 bg-brand-surface p-1 ${c.inMonth ? "" : "opacity-50"}`}>
                  <button type="button" onClick={() => { setAnchor(c.key); setView("day"); }} className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${c.key === todayKey ? "bg-brand-teal text-brand-onAccent" : "text-brand-ink hover:bg-brand-mint"}`} aria-label={`${c.key}, ${list.length} events`}>{Number(c.key.slice(8))}</button>
                  {list.slice(0, 3).map(chip)}
                  {list.length > 3 && <button type="button" className="text-xs font-semibold text-brand-teal" onClick={() => { setAnchor(c.key); setView("day"); }}>+{list.length - 3} more</button>}
                </div>
              );
            })}
          </div>
          {/* On a phone the month is a list of the days that have events. */}
          <ul className="space-y-2 sm:hidden">
            {monthGrid(y, m).flat().filter((c) => c.inMonth && (byDay.get(c.key)?.length ?? 0) > 0).map((c) => (
              <li key={c.key}><p className="text-sm font-semibold text-brand-ink">{formatDay(new Date(`${c.key}T12:00:00Z`), "UTC")}</p><div className="mt-1 space-y-1">{(byDay.get(c.key) ?? []).map(chip)}</div></li>
            ))}
            {monthGrid(y, m).flat().every((c) => !c.inMonth || !byDay.get(c.key)?.length) && <li className="text-sm text-gray-600">No events this month.</li>}
          </ul>
        </>
      )}
      {view === "week" && (
        <ul className="grid gap-2 sm:grid-cols-7">
          {weekDays(anchor).map((k) => (
            <li key={k} className={`rounded-xl border p-2 ${k === todayKey ? "border-brand-teal" : "border-brand-gray"}`}>
              <p className="text-xs font-semibold text-brand-ink">{formatDay(new Date(`${k}T12:00:00Z`), "UTC")}</p>
              <div className="mt-1 space-y-1">{(byDay.get(k) ?? []).map(chip)}{!(byDay.get(k)?.length) && <p className="text-xs text-gray-500">Nothing</p>}</div>
            </li>
          ))}
        </ul>
      )}
      {view === "day" && (
        <div className="space-y-2">
          {(byDay.get(anchor) ?? []).map((e) => (
            <Link key={e.id} href={href(e.id)} className="block rounded-xl border border-brand-gray bg-brand-surface p-3 hover:bg-brand-mint/40">
              <p className="font-semibold text-brand-ink">{e.title}</p>
              <p className="text-xs text-gray-600">{time(e)} {e.timeZone} · {e.organizerName} · {e.delivery.toLowerCase()} · {phaseOf({ status: e.status, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt) }).toLowerCase()}</p>
            </Link>
          ))}
          {!(byDay.get(anchor)?.length) && <p className="rounded-xl border border-dashed border-brand-gray p-6 text-center text-sm text-gray-600">No events on this day.</p>}
        </div>
      )}
    </div>
  );
}
