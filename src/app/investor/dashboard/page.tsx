"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/investor/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

import { Select } from "@/components/ui/Field";
interface PitchTeaser {
  id: string;
  startupName: string;
  industry: string | null;
  stage: string | null;
  problemExcerpt: string | null;
  fundingType: "GRANT" | "DEBT" | null;
  fundingAmountKobo: number | null;
  teaserVideoUrl: string | null;
  projectedReturnSummary: string | null;
  publicImpactStatement: string | null;
  founderReadiness: { courseTitle: string; percentage: number | null; topPercent: number | null } | null;
  disclosureStatus: "PENDING" | "ACCEPTED" | "DECLINED" | null;
  watchlisted: boolean;
}

/**
 * /investor/dashboard — every PUBLISHED pitch, teaser-only until this
 * investor's own disclosure is ACCEPTED. Filtering and the watchlist
 * are both done client-side over the already-fetched list: the pool is
 * small and staff-curated (batched by cohort, not continuously
 * growing), so a second round trip per filter change would be
 * over-engineering for the actual scale this runs at.
 */
export default function InvestorDashboardPage() {
  const router = useRouter();
  const [pitches, setPitches] = useState<PitchTeaser[] | null>(null);
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [fundingType, setFundingType] = useState<"" | "GRANT" | "DEBT">("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    // Phase 2 — a PENDING/REJECTED investor can log in (see
    // investor-login's own comment) but has nothing real to do here
    // yet; bounce to the status page rather than showing an
    // indistinguishable-from-broken empty grid.
    fetch("/api/investor/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((me) => {
        if (me.approvalState !== "APPROVED") router.replace("/investor/status");
      })
      .catch(() => router.replace("/investor/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/investor/pitches")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPitches)
      .catch(() => setPitches([]));
  }, []);

  async function toggleWatchlist(id: string) {
    setTogglingId(id);
    const res = await fetch(`/api/investor/pitches/${id}/watchlist`, { method: "POST" });
    setTogglingId(null);
    if (!res.ok) return;
    const data = await res.json();
    setPitches((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, watchlisted: data.watchlisted } : p)) : prev));
  }

  const sectors = useMemo(() => Array.from(new Set((pitches ?? []).map((p) => p.industry).filter((v): v is string => !!v))), [pitches]);
  const stages = useMemo(() => Array.from(new Set((pitches ?? []).map((p) => p.stage).filter((v): v is string => !!v))), [pitches]);

  const filtered = (pitches ?? []).filter((p) => {
    if (sector && p.industry !== sector) return false;
    if (stage && p.stage !== stage) return false;
    if (fundingType && p.fundingType !== fundingType) return false;
    if (watchlistOnly && !p.watchlisted) return false;
    return true;
  });

  return (
    <>
      <SiteHeader nav={[{ label: "Investment Opportunities", href: "/investor/dashboard" }]} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Investment Opportunities</h1>
        <p className="mt-1 text-sm text-gray-500">Pitches AAICBI has reviewed and published from its trainee founders.</p>

        {pitches !== null && pitches.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Select label="Sector" hideLabel compact controlClassName="text-xs font-semibold" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">All Sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select label="Stage" hideLabel compact controlClassName="text-xs font-semibold" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All Stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <div className="flex gap-1">
              {(["GRANT", "DEBT"] as const).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFundingType(fundingType === ft ? "" : ft)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    fundingType === ft ? "bg-brand-teal text-white" : "border border-brand-gray text-brand-ink"
                  }`}
                >
                  {ft === "GRANT" ? "Grant" : "Debt"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWatchlistOnly((v) => !v)}
              className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold ${
                watchlistOnly ? "bg-brand-gold text-white" : "border border-brand-gray text-brand-ink"
              }`}
            >
              ★ Watchlist only
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pitches === null && <SkeletonList rows={4} />}
          {pitches?.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No pitches published yet" description="Check back after the next cohort's Demo Day." />
            </div>
          )}
          {pitches !== null && pitches.length > 0 && filtered.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No pitches match these filters" description="Try clearing a filter above." />
            </div>
          )}
          {filtered.map((p) => (
            <a key={p.id} href={`/investor/pitches/${p.id}`}>
              <Card interactive className="h-full hover:border-brand-teal">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.industry && <Badge variant="success">{p.industry}</Badge>}
                    {p.stage && <span className="text-xs font-semibold text-gray-500">{p.stage}</span>}
                  </div>
                  <button
                    type="button"
                    disabled={togglingId === p.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleWatchlist(p.id);
                    }}
                    aria-label={p.watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                    className={`text-lg ${p.watchlisted ? "text-brand-gold" : "text-gray-300 hover:text-brand-gold"}`}
                  >
                    {p.watchlisted ? "★" : "☆"}
                  </button>
                </div>
                <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{p.startupName}</p>
                {p.founderReadiness && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-goldLight px-2 py-0.5 text-xs font-bold text-brand-goldText">
                    ⭐{p.founderReadiness.topPercent != null && ` Top ${p.founderReadiness.topPercent}% ·`}
                    {p.founderReadiness.percentage != null && ` ${Math.round(p.founderReadiness.percentage)}% ·`} Certified: {p.founderReadiness.courseTitle}
                  </p>
                )}
                {p.problemExcerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.problemExcerpt}</p>}
                {p.teaserVideoUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(p.teaserVideoUrl!, "_blank", "noopener,noreferrer");
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:underline"
                  >
                    ▶ Watch teaser
                  </button>
                )}
                {p.projectedReturnSummary && (
                  <p className="mt-2 rounded-lg bg-brand-goldLight px-2.5 py-1.5 text-xs font-semibold text-brand-goldText">
                    {p.projectedReturnSummary}
                  </p>
                )}
                {p.publicImpactStatement && <p className="mt-2 text-xs text-gray-600">{p.publicImpactStatement}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-tealDeep">
                    {p.fundingAmountKobo != null ? `₦${(p.fundingAmountKobo / 100).toLocaleString()}` : "—"} {p.fundingType ? `· ${p.fundingType}` : ""}
                  </span>
                  {p.disclosureStatus === "ACCEPTED" ? (
                    <Badge variant="success">Full pitch unlocked</Badge>
                  ) : p.disclosureStatus === "PENDING" ? (
                    <Badge variant="neutral">Request pending</Badge>
                  ) : null}
                </div>
              </Card>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
