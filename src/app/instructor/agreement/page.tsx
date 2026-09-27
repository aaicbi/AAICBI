"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import AgreementSigningCard from "@/components/instructor/AgreementSigningCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface Agreement {
  id: string;
  content: string;
  status: "PENDING" | "ACCEPTED";
  sentAt: string;
  sentBy: { name: string };
  acceptedAt: string | null;
  acceptedName: string | null;
}

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/**
 * /instructor/agreement — reachable any time from the nav to review the
 * agreement. The actual onboarding gate now lives on
 * /instructor/dashboard (the agreement shows there as the first card
 * for a PENDING agreement, per the explicit request that acceptance
 * happen right on the dashboard rather than a forced separate page) —
 * this page is a secondary way to reach the exact same
 * AgreementSigningCard, plus a read-only view once already accepted.
 */
export default function InstructorAgreementPage() {
  const router = useRouter();
  const [agreement, setAgreement] = useState<Agreement | null | undefined>(undefined);

  function load() {
    fetch("/api/instructor/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAgreement)
      .catch(() => router.replace("/admin/login"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Instructor Agreement</h1>
        <p className="mt-1 text-sm text-gray-500">Your agreement with AAICBI, on file.</p>

        {agreement === undefined && <div className="mt-6"><SkeletonList rows={3} /></div>}

        {agreement === null && (
          <div className="mt-6">
            <EmptyState
              title="No agreement on file yet"
              description="Your Super Admin hasn't sent your agreement yet. You'll receive an email as soon as it's ready to review."
            />
          </div>
        )}

        {agreement && agreement.status === "PENDING" && (
          <div className="mt-6">
            <AgreementSigningCard agreement={agreement} onAccepted={load} />
          </div>
        )}

        {agreement && agreement.status === "ACCEPTED" && (
          <Card className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-ink">Accepted {agreement.acceptedAt && new Date(agreement.acceptedAt).toLocaleString()}</p>
              <Badge variant="success">Accepted</Badge>
            </div>
            <p className="mt-1 text-xs text-gray-500">Signed as "{agreement.acceptedName}"</p>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-brand-gray bg-brand-surface p-4 text-sm leading-relaxed text-brand-ink whitespace-pre-wrap">
              {agreement.content}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
