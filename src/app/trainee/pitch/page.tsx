"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface PitchRow {
  id: string;
  startupName: string;
  status: "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "APPROVED" | "REJECTED" | "PUBLISHED";
  createdAt: string;
}

const STATUS_LABEL: Record<PitchRow["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Under Review",
  NEEDS_REVISION: "Needs Revision",
  APPROVED: "Approved",
  REJECTED: "Not Approved",
  PUBLISHED: "Published",
};

const STATUS_VARIANT: Record<PitchRow["status"], "neutral" | "warning" | "success" | "danger" | "gold"> = {
  DRAFT: "neutral",
  SUBMITTED: "warning",
  NEEDS_REVISION: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  PUBLISHED: "gold",
};

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "Pitch & Post", href: "/trainee/pitch" },
  { label: "My Profile", href: "/trainee/profile" },
  { label: "Settings", href: "/trainee/settings" },
];

/**
 * /trainee/pitch — "Your Ventures". Pitch & Post, Phase 1's founder
 * home: the eligibility gate (holding at least one certificate) shows
 * as a locked teaser rather than hiding the page entirely, so it reads
 * as a goal rather than a wall.
 */
export default function TraineePitchPage() {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [pitches, setPitches] = useState<PitchRow[] | null>(null);

  useEffect(() => {
    fetch("/api/trainee/pitch-eligibility")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEligible(d.eligible))
      .catch(() => setEligible(false));
    fetch("/api/trainee/pitches")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPitches)
      .catch(() => setPitches([]));
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Your Ventures</h1>
          {eligible && (
            <Button href="/trainee/pitch/new" size="sm">
              New Pitch
            </Button>
          )}
        </div>

        {eligible === false && (
          <Card className="mt-6 border-brand-gold bg-brand-goldLight/40">
            <p className="text-sm font-semibold text-brand-goldText">Earn a certificate in an eligible track to unlock pitching.</p>
            <p className="mt-1 text-sm text-gray-600">Once you've completed a course and earned your certificate, you can submit a pitch here.</p>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {pitches === null ? (
            <SkeletonList />
          ) : pitches.length === 0 ? (
            eligible ? (
              <EmptyState title="No pitches yet" description="Submit your first pitch to get started." />
            ) : null
          ) : (
            pitches.map((p) => (
              <a key={p.id} href={`/trainee/pitch/${p.id}`}>
                <Card interactive className="flex items-center justify-between hover:border-brand-teal">
                  <p className="font-display font-semibold text-brand-ink">{p.startupName}</p>
                  <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </Card>
              </a>
            ))
          )}
        </div>
      </main>
    </>
  );
}
