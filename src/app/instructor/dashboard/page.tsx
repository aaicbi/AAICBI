"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import AgreementSigningCard from "@/components/instructor/AgreementSigningCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface CourseSummary {
  id: string;
  title: string;
  status: string;
  _count: { modules: number };
}
interface PayoutSummary {
  month: string;
  totalEntitlementKobo: number;
}
interface Agreement {
  id: string;
  content: string;
  status: "PENDING" | "ACCEPTED";
  sentBy: { name: string };
}

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/**
 * /instructor/dashboard — the Instructor Portal's landing page AND its
 * onboarding gate, per the explicit request that the agreement appear
 * as the first thing an instructor sees here rather than a separate
 * forced redirect page: a PENDING agreement renders as the ONLY card
 * (AgreementSigningCard), full-width, above everything else; the
 * moment it's accepted, the same page swaps straight into the normal
 * dashboard with no navigation away. /instructor/agreement still exists
 * for reviewing the agreement later from the nav, but this page is now
 * where every instructor actually lands and where the gate lives — the
 * other /instructor/* pages redirect back HERE (not to /instructor/agreement)
 * when there's no accepted agreement yet.
 */
export default function InstructorDashboardPage() {
  const router = useRouter();
  const [agreement, setAgreement] = useState<Agreement | null | undefined>(undefined);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [payout, setPayout] = useState<PayoutSummary | null>(null);

  function loadAgreement() {
    fetch("/api/instructor/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAgreement)
      .catch(() => router.replace("/admin/login"));
  }

  useEffect(() => {
    loadAgreement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (agreement?.status !== "ACCEPTED") return;
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setCourses([]));
    fetch("/api/instructor/payments/payout")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPayout)
      .catch(() => setPayout(null));
  }, [agreement]);

  if (agreement === undefined) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <SkeletonList rows={3} />
        </main>
      </>
    );
  }

  if (agreement === null) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Welcome</h1>
          <div className="mt-6">
            <EmptyState
              title="No agreement on file yet"
              description="Your Super Admin hasn't sent your agreement yet. You'll receive an email as soon as it's ready to review, and it will appear here."
            />
          </div>
        </main>
      </>
    );
  }

  if (agreement.status === "PENDING") {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Welcome to AAICBI</h1>
          <p className="mt-1 text-sm text-gray-500">Review and accept your agreement below to unlock the rest of the Instructor Portal.</p>
          <div className="mt-6">
            <AgreementSigningCard agreement={agreement} onAccepted={loadAgreement} />
          </div>
        </main>
      </>
    );
  }

  const totalCourses = courses?.length ?? 0;
  const totalModules = courses?.reduce((sum, c) => sum + c._count.modules, 0) ?? 0;

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Instructor Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Your courses, materials, and payout — at a glance.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-semibold text-gray-500">Courses You Teach</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{courses === null ? "—" : totalCourses}</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-gray-500">Total Modules</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand-ink">{courses === null ? "—" : totalModules}</p>
          </Card>
          <Card variant="highlighted">
            <p className="text-xs font-semibold text-gray-500">Current Monthly Entitlement</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand-tealDeep">
              {payout === null ? "—" : `₦${(payout.totalEntitlementKobo / 100).toLocaleString()}`}
            </p>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Your Courses</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses === null && <SkeletonList rows={2} />}
            {courses?.map((c) => (
              <a key={c.id} href={`/instructor/courses/${c.id}`}>
                <Card interactive>
                  <p className="font-semibold text-brand-ink">{c.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {c._count.modules} module{c._count.modules === 1 ? "" : "s"} · {c.status}
                  </p>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
