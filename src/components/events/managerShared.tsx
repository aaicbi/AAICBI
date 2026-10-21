"use client";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { AUDIENCE_SHORT, DELIVERY_LABEL, PHASE_LABEL, formatWhen, type Phase, type Promotion } from "@/lib/events/eventsCore";
import type { EventView, ManagedRow, OverviewNumbers } from "@/lib/events/events";

export interface ManagerData {
  items: ManagedRow[]; total: number; page: number; pageSize: number; overview: OverviewNumbers;
  categories: { id: string; name: string; slug: string; active: boolean }[];
  settings: { enabled: boolean; orgEventsEnabled: boolean; promotionsEnabled: boolean; registrationEnabled: boolean; showPast: boolean; joinOpensMinutes: number };
  actor: { kind: string; orgId: string | null; orgName: string | null; permissions: string[] };
}

/** Loads the manager's list for a set of filters; re-loads on demand. Errors become a message, never a blank screen. */
export function useManagerList(apiBase: string, query: string) {
  const [data, setData] = useState<ManagerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`${apiBase}?${query}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? "Could not load events."); return; }
      setData(j);
    } catch { setError("Could not load events."); }
  }, [apiBase, query]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}

export const phaseVariant = (p: Phase): "success" | "warning" | "danger" | "neutral" | "gold" => (p === "LIVE" ? "danger" : p === "UPCOMING" ? "success" : p === "DRAFT" ? "warning" : p === "CANCELLED" ? "danger" : "neutral");
export const promoVariant = (p: Promotion): "success" | "warning" | "danger" | "neutral" | "gold" => (p === "PUBLISHED" ? "gold" : p === "APPROVED" ? "success" : p === "SUBMITTED" || p === "CHANGES_REQUESTED" ? "warning" : p === "REJECTED" ? "danger" : "neutral");

export function StatusBadges({ e }: { e: EventView }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={phaseVariant(e.phase)}>{PHASE_LABEL[e.phase]}</Badge>
      <Badge>{AUDIENCE_SHORT[e.audience]}</Badge>
      {e.audience === "PUBLIC" && e.managed && e.managed.promotionStatus !== "NONE" && <Badge variant={promoVariant(e.managed.promotionStatus)}>{e.managed.promotionLabel}</Badge>}
    </span>
  );
}

export const whenOf = (e: EventView) => formatWhen(new Date(e.startsAt), new Date(e.endsAt), e.timeZone);
export const placeOf = (e: EventView) => (e.delivery === "ONLINE" ? e.conferenceProvider ?? "" : [e.venueName, e.city].filter(Boolean).join(", "));
/** "Online · Google Meet", "Physical · Landmark Centre, Lagos", "Hybrid · Landmark Centre, Lagos". */
export const howOf = (e: EventView) => [DELIVERY_LABEL[e.delivery], placeOf(e)].filter(Boolean).join(" · ");
