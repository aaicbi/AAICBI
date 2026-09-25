"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface PaymentRow {
  id: string;
  reference: string;
  amountKobo: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";
  method: string | null;
  initiatedAt: string;
  confirmedAt: string | null;
  trainee: { id: string; name: string; email: string };
  course: { id: string; title: string };
}

const STATUS_VARIANT: Record<PaymentRow["status"], "success" | "warning" | "danger" | "neutral"> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
  ABANDONED: "neutral",
};

const FILTERS: Array<{ label: string; value: PaymentRow["status"] | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Success", value: "SUCCESS" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
  { label: "Abandoned", value: "ABANDONED" },
];

/**
 * Course enrollment/subscription system — the platform-wide payment
 * reconciliation view (task Section 23). Read-only + a status filter,
 * on purpose: any action on a specific trainee's access (revoke,
 * extend) already lives on that course's own Enrollments page, which
 * has the ownership-scoped context to act correctly — duplicating
 * those actions here would just be a second place for them to drift.
 */
export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<PaymentRow["status"] | "ALL">("ALL");

  function load() {
    setLoadError(false);
    setPayments(null);
    fetch("/api/admin/payments")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPayments)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = payments?.filter((p) => filter === "ALL" || p.status === filter) ?? null;

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Performance", href: "/admin/performance" },
          { label: "Payments", href: "/admin/payments" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every payment attempt across your courses, most recent first.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? "rounded-full bg-brand-teal px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border border-brand-gray px-3 py-1 text-xs font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {loadError ? (
            <ErrorState message="We couldn't load payments." onRetry={load} />
          ) : filtered === null ? (
            <SkeletonList rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No payments found" description="Nothing matches this filter yet." />
          ) : (
            filtered.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">
                    <Link href={`/admin/courses/${p.course.id}`} className="hover:underline">
                      {p.course.title}
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.trainee.name} ({p.trainee.email})
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ref: {p.reference} · {new Date(p.initiatedAt).toLocaleString()}
                    {p.method ? ` · via ${p.method}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-brand-ink">
                    ₦{(p.amountKobo / 100).toLocaleString()}
                  </p>
                  <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
