"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface CoursePayout {
  courseId: string;
  courseTitle: string;
  payoutType: "PERCENTAGE_OF_REVENUE" | "FLAT_PER_SUBSCRIBER" | null;
  payoutPercentage: number | null;
  payoutFlatRateKobo: number | null;
  payoutNotes: string | null;
  revenueKobo: number;
  payerCount: number;
  entitlementKobo: number | null;
}
interface PayoutResponse {
  month: string;
  courses: CoursePayout[];
  totalEntitlementKobo: number;
}

const NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * /instructor/payments — "Calculated Entitlement" per the master
 * spec's own distinction (Agreed Compensation lives on the Agreement
 * page; Payment Status/disbursement tracking is Phase 3). Never
 * editable here — this is a read-only view of what Super Admin has
 * configured on each course's payout, computed from real Payment data.
 */
export default function InstructorPaymentsPage() {
  const router = useRouter();
  const [gateChecked, setGateChecked] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<PayoutResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instructor/agreement")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d?.status !== "ACCEPTED") router.replace("/instructor/dashboard");
        else setGateChecked(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!gateChecked) return;
    setLoading(true);
    fetch(`/api/instructor/payments/payout?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [gateChecked, month]);

  if (!gateChecked) return null;

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">My Payments</h1>
            <p className="mt-1 text-sm text-gray-500">Your calculated entitlement for {monthLabel(month)}.</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
        </div>

        {loading && <div className="mt-6"><SkeletonList rows={2} /></div>}

        {!loading && data && (
          <>
            <Card variant="highlighted" className="mt-6">
              <p className="text-xs font-semibold text-gray-500">Total Calculated Entitlement — {monthLabel(data.month)}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-brand-tealDeep">
                ₦{(data.totalEntitlementKobo / 100).toLocaleString()}
              </p>
            </Card>

            <div className="mt-6 space-y-3">
              {data.courses.length === 0 && <EmptyState title="No courses assigned yet" description="Your payout will appear here once you're assigned a course." />}
              {data.courses.map((c) => (
                <Card key={c.courseId}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-brand-ink">{c.courseTitle}</p>
                    {c.payoutType ? (
                      <Badge variant="success">
                        {c.payoutType === "PERCENTAGE_OF_REVENUE" ? `${c.payoutPercentage}% of revenue` : `₦${((c.payoutFlatRateKobo ?? 0) / 100).toLocaleString()} / subscriber`}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Not yet configured</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-500">Revenue this month</p>
                      <p className="font-semibold text-brand-ink">₦{(c.revenueKobo / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paying subscribers</p>
                      <p className="font-semibold text-brand-ink">{c.payerCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Your entitlement</p>
                      <p className="font-semibold text-brand-tealDeep">
                        {c.entitlementKobo != null ? `₦${(c.entitlementKobo / 100).toLocaleString()}` : "—"}
                      </p>
                    </div>
                  </div>
                  {c.payoutNotes && <p className="mt-3 text-xs text-gray-500">{c.payoutNotes}</p>}
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
