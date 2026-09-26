"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PitchTeaser {
  id: string;
  startupName: string;
  industry: string | null;
  stage: string | null;
  problemExcerpt: string | null;
  fundingType: "GRANT" | "DEBT" | null;
  fundingAmountKobo: number | null;
  disclosureStatus: "PENDING" | "ACCEPTED" | "DECLINED" | null;
}

/**
 * /investor/dashboard — Pitch & Post, Phase 1's curated-pool browse
 * view: every PUBLISHED pitch, teaser-only until this investor's own
 * disclosure is ACCEPTED. No sector/stage filtering yet — the pool is
 * small and staff-curated for Phase 1, so a plain list is enough.
 */
export default function InvestorDashboardPage() {
  const [pitches, setPitches] = useState<PitchTeaser[] | null>(null);

  useEffect(() => {
    fetch("/api/investor/pitches")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPitches)
      .catch(() => setPitches([]));
  }, []);

  return (
    <>
      <SiteHeader nav={[{ label: "Investment Opportunities", href: "/investor/dashboard" }]} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Investment Opportunities</h1>
        <p className="mt-1 text-sm text-gray-500">Pitches AAICBI has reviewed and published from its trainee founders.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pitches === null && <SkeletonList rows={4} />}
          {pitches?.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No pitches published yet" description="Check back after the next cohort's Demo Day." />
            </div>
          )}
          {pitches?.map((p) => (
            <a key={p.id} href={`/investor/pitches/${p.id}`}>
              <Card interactive className="h-full hover:border-brand-teal">
                <div className="flex items-center justify-between">
                  {p.industry && <Badge variant="success">{p.industry}</Badge>}
                  {p.stage && <span className="text-xs font-semibold text-gray-500">{p.stage}</span>}
                </div>
                <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{p.startupName}</p>
                {p.problemExcerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.problemExcerpt}</p>}
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
