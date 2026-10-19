"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { PERIODS, STATUS_LABEL, type Period } from "@/lib/ads/adsCore";
import type { adsReport, ReportAd } from "@/lib/ads/ads";

type Report = Awaited<ReturnType<typeof adsReport>>;
const PERIOD_LABEL: Record<Period, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

function Bars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-12 items-end gap-0.5" role="img" aria-label={label}>
      {values.map((v, i) => <span key={i} className="flex-1 rounded-t bg-brand-teal" style={{ height: `${Math.max(v > 0 ? 8 : 2, (v / max) * 100)}%` }} />)}
    </div>
  );
}

/** Views, taps and tap rate for each ad. A Super Admin sees every ad; an organization sees only its own. */
export default function AdsReport({ isSuper }: { isSuper: boolean }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/ads/report?period=${period}`, { cache: "no-store" });
    if (!res.ok) { setError("The report could not be loaded."); return; }
    setData(await res.json()); setError(null);
  }, [period]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;
  return (
    <div data-testid="ads-report">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${period === p ? "bg-brand-action text-brand-onAccent" : "border border-brand-gray text-brand-ink hover:bg-brand-mint"}`}>{PERIOD_LABEL[p]}</button>)}
        <a href={`/api/admin/ads/report?period=${period}&format=csv`} className="ml-auto min-h-[44px] rounded-full border border-brand-gray px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-mint" data-testid="ads-csv">Download spreadsheet</a>
      </div>
      {data.scope === "NONE" ? (
        <Card className="mt-4"><p className="text-sm text-brand-ink" data-testid="ads-none">Your organization has no ads yet. When AAICBI books one for you, its numbers appear here.</p></Card>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="ads-totals">
            <Card><p className="text-xs font-semibold uppercase text-gray-600">Views</p><p className="font-display text-2xl font-semibold text-brand-ink" data-testid="tot-views">{data.totals.views.toLocaleString()}</p></Card>
            <Card><p className="text-xs font-semibold uppercase text-gray-600">Taps</p><p className="font-display text-2xl font-semibold text-brand-ink" data-testid="tot-taps">{data.totals.taps.toLocaleString()}</p></Card>
            <Card><p className="text-xs font-semibold uppercase text-gray-600">Tap rate</p><p className="font-display text-2xl font-semibold text-brand-ink">{data.totals.tapRate}%</p></Card>
          </div>
          <p className="mt-2 text-xs text-gray-600">A view is counted when the ad has been on screen for a moment; a tap when someone opens the advertiser&apos;s link. {isSuper ? "" : "Only your organization's ads are shown."}</p>
          <ul className="mt-4 space-y-3">
            {data.ads.length === 0 && <li><Card><p className="text-sm text-brand-ink">No ads booked yet.</p></Card></li>}
            {data.ads.map((a: ReportAd) => (
              <li key={a.id} data-testid="ads-report-row">
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-semibold text-brand-ink">{a.headline}</p><p className="text-sm text-gray-700">{a.advertiserName} · {a.startsOn} to {a.endsOn}</p></div>
                    <Badge variant={a.status === "LIVE" ? "success" : "neutral"}>{STATUS_LABEL[a.status]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-brand-ink">{a.views.toLocaleString()} views · {a.taps.toLocaleString()} taps · {a.tapRate}% tap rate</p>
                  <div className="mt-2"><Bars values={a.series} label={`Views per day for ${a.headline}`} /></div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
