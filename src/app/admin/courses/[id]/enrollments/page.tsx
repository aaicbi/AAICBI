"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface EnrollmentDto {
  id: string;
  source: "FREE" | "ADMIN_GRANTED" | "PAID";
  enrolledAt: string;
  accessRevokedAt: string | null;
  trainee: { id: string; name: string; email: string };
  enrolledBy: { name: string } | null;
}

const SOURCE_LABEL: Record<EnrollmentDto["source"], string> = {
  FREE: "Free (self-enrolled)",
  ADMIN_GRANTED: "Admin-granted",
  PAID: "Paid",
};

/**
 * M19 — the admin-granted half of course enrollment. The free
 * self-enroll path lives entirely on the trainee-facing course page;
 * this is the staff-facing counterpart, and the only UI in the app
 * that can revoke access at all — see the revoke route's own comment
 * on why that was a genuinely open gap before this page existed.
 */
export default function CourseEnrollmentsPage({ params }: { params: { id: string } }) {
  const [enrollments, setEnrollments] = useState<EnrollmentDto[] | null>(null);
  const [enrollmentsError, setEnrollmentsError] = useState(false);
  const [email, setEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <>
      <SiteHeader />
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
            enrollments.map((e) => (
              <Card key={e.id} className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{e.trainee.name}</p>
                  <p className="text-xs text-gray-500">
                    {e.trainee.email} · {SOURCE_LABEL[e.source]}
                    {e.enrolledBy && ` by ${e.enrolledBy.name}`}
                  </p>
                </div>
                <div className="text-right">
                  {e.accessRevokedAt ? (
                    <Badge variant="danger">Revoked</Badge>
                  ) : (
                    <>
                      <Badge variant="success">Active</Badge>
                      <button
                        onClick={() => revoke(e.id)}
                        className="mt-1 block text-xs font-semibold text-brand-rose hover:underline"
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
