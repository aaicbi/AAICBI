"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface PaymentDto {
  id: string;
  amountKobo: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";
  method: string | null;
  initiatedAt: string;
}
interface EnrollmentDto {
  id: string;
  source: "FREE" | "ADMIN_GRANTED" | "PAID";
  enrolledAt: string;
  accessRevokedAt: string | null;
  unlockedAt: string | null;
  currentPeriodEnd: string | null;
  completedAt: string | null;
  trainee: { id: string; name: string; email: string };
  enrolledBy: { name: string } | null;
  payments: PaymentDto[];
}

const SOURCE_LABEL: Record<EnrollmentDto["source"], string> = {
  FREE: "Free (self-enrolled)",
  ADMIN_GRANTED: "Admin-granted",
  PAID: "Paid",
};

/**
 * Course enrollment/subscription system — derived purely client-side
 * from fields the API already sends, same reasoning as
 * deriveEnrollmentStatus (src/lib/courseAccess.ts): a display label has
 * no business being a separately-maintained source of truth. Mirrors
 * that function's own precedence exactly (completed beats expired
 * beats awaiting-unlock beats active) rather than reimplementing the
 * logic differently here.
 */
function deriveStatus(e: EnrollmentDto): { label: string; variant: "success" | "warning" | "danger" | "neutral" | "gold" } {
  if (e.completedAt) return { label: "Completed", variant: "gold" };
  if (e.accessRevokedAt) return { label: "Expired / Revoked", variant: "danger" };
  if (!e.unlockedAt) return { label: "Awaiting Unlock", variant: "warning" };
  return { label: "Active", variant: "success" };
}

/**
 * M19 — the admin-granted half of course enrollment. The free
 * self-enroll path lives entirely on the trainee-facing course page;
 * this is the staff-facing counterpart, and the only UI in the app
 * that can revoke access at all — see the revoke route's own comment
 * on why that was a genuinely open gap before this page existed.
 *
 * Course enrollment/subscription system — extended to surface
 * subscription/payment state (currentPeriodEnd, the latest Payment,
 * derived status) and a manual "Extend Access" action, per the plan's
 * admin-enrollment-management scope.
 */
export default function CourseEnrollmentsPage({ params }: { params: { id: string } }) {
  const [enrollments, setEnrollments] = useState<EnrollmentDto[] | null>(null);
  const [enrollmentsError, setEnrollmentsError] = useState(false);
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null); // enrollmentId currently showing the extend form
  const [extendDays, setExtendDays] = useState("30");
  const [extendReason, setExtendReason] = useState("");
  const [extendSaving, setExtendSaving] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setEnrollmentsError(false);
    fetch(`/api/courses/${params.id}/enrollments`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEnrollments)
      .catch(() => setEnrollmentsError(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function grant() {
    setGranting(true);
    setError(null);
    const res = await fetch(`/api/courses/${params.id}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setGranting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not grant access.");
      return;
    }
    setEmail("");
    showToast("Access granted.", "success");
    load();
  }

  async function revoke(enrollmentId: string) {
    const res = await fetch(`/api/courses/${params.id}/enrollments/${enrollmentId}`, { method: "PATCH" });
    if (!res.ok) {
      showToast("Could not revoke access. Try again.", "error");
      return;
    }
    showToast("Access revoked.", "success");
    load();
  }

  function startExtend(enrollmentId: string) {
    setExtending(enrollmentId);
    setExtendDays("30");
    setExtendReason("");
    setExtendError(null);
  }

  async function submitExtend(enrollmentId: string) {
    const days = Number(extendDays);
    if (!Number.isInteger(days) || days <= 0) {
      setExtendError("Enter a positive whole number of days.");
      return;
    }
    if (extendReason.trim() === "") {
      setExtendError("A reason is required.");
      return;
    }
    setExtendSaving(true);
    setExtendError(null);
    const res = await fetch(`/api/courses/${params.id}/enrollments/${enrollmentId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, reason: extendReason.trim() }),
    });
    setExtendSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setExtendError(typeof data.error === "string" ? data.error : "Could not extend access.");
      return;
    }
    setExtending(null);
    showToast(`Access extended by ${days} day(s).`, "success");
    load();
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Enrollments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Grant a trainee access directly — works for paid courses too, not just free ones.
        </p>

        <Card className="mt-6">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trainee@example.com"
              aria-label="Trainee email"
              className="flex-1 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <Button onClick={grant} loading={granting} disabled={!email}>
              Grant Access
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-brand-rose">{error}</p>}
        </Card>

        <div className="mt-6 space-y-3">
          {enrollmentsError ? (
            <ErrorState message="We couldn't load enrollments." onRetry={load} />
          ) : enrollments === null ? (
            <SkeletonList />
          ) : enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">No one is enrolled in this course yet.</p>
          ) : (
            enrollments.map((e) => {
              const status = deriveStatus(e);
              const latestPayment = e.payments[0];
              return (
                <Card key={e.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-brand-ink">{e.trainee.name}</p>
                      <p className="text-xs text-gray-500">
                        {e.trainee.email} · {SOURCE_LABEL[e.source]}
                        {e.enrolledBy && ` by ${e.enrolledBy.name}`}
                      </p>
                      {e.currentPeriodEnd && (
                        <p className="mt-1 text-xs text-gray-500">
                          Access {e.accessRevokedAt ? "ended" : "renews/expires"}:{" "}
                          {new Date(e.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      )}
                      {latestPayment && (
                        <p className="mt-1 text-xs text-gray-500">
                          Last payment: ₦{(latestPayment.amountKobo / 100).toLocaleString()} —{" "}
                          {latestPayment.status}
                          {latestPayment.method ? ` via ${latestPayment.method}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <div className="mt-1 flex flex-col items-end gap-1">
                        {!e.accessRevokedAt && (
                          <button
                            onClick={() => revoke(e.id)}
                            className="block text-xs font-semibold text-brand-rose hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                        <button
                          onClick={() => startExtend(e.id)}
                          className="block text-xs font-semibold text-brand-teal hover:underline"
                        >
                          Extend Access
                        </button>
                      </div>
                    </div>
                  </div>

                  {extending === e.id && (
                    <div className="mt-3 space-y-2 border-t border-brand-gray pt-3">
                      <label className="block text-xs text-gray-700">
                        Extend by (days)
                        <input
                          type="number"
                          min={1}
                          value={extendDays}
                          onChange={(ev) => setExtendDays(ev.target.value)}
                          className="mt-1 w-full max-w-[8rem] rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                        />
                      </label>
                      <label className="block text-xs text-gray-700">
                        Reason (required, kept in the audit trail)
                        <input
                          value={extendReason}
                          onChange={(ev) => setExtendReason(ev.target.value)}
                          placeholder="e.g. Support gesture — payment gateway issue on trainee's end"
                          className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
                        />
                      </label>
                      {extendError && <p className="text-xs text-brand-rose">{extendError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitExtend(e.id)}
                          disabled={extendSaving}
                          className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {extendSaving ? "Saving..." : "Confirm Extension"}
                        </button>
                        <button
                          onClick={() => setExtending(null)}
                          className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
