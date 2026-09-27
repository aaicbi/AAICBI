"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";

interface InstructorRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  courseCount: number;
  latestAgreement: { status: "PENDING" | "ACCEPTED"; sentAt: string; acceptedAt: string | null } | null;
}

/**
 * /admin/instructors — the master spec's "Instructor Management" page.
 * Account creation stays on /admin/staff (already creates INSTRUCTOR
 * accounts with the setup-link-email pattern the spec wants); this
 * page is where a Super Admin sees agreement status, course load, and
 * jumps into each instructor's detail page for payout configuration.
 */
export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorRow[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setError(false);
    fetch("/api/admin/instructors")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInstructors)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(id: string, active: boolean) {
    setBusyId(id);
    await fetch(`/api/admin/instructors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setBusyId(null);
    load();
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Instructors", href: "/admin/instructors" },
          { label: "Agreement Templates", href: "/admin/agreement-templates" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Instructors</h1>
            <p className="mt-1 text-sm text-gray-500">Agreement status, course load, and payout configuration for each instructor.</p>
          </div>
          <Button href="/admin/staff">+ Add Instructor</Button>
        </div>

        <div className="mt-6 space-y-3">
          {error ? (
            <ErrorState message="We couldn't load instructors." onRetry={load} />
          ) : instructors === null ? (
            <SkeletonList />
          ) : instructors.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No instructors yet. Create one from Staff Accounts.</p>
            </Card>
          ) : (
            instructors.map((i) => (
              <Card key={i.id}>
                <div className="flex items-center justify-between">
                  <a href={`/admin/instructors/${i.id}`} className="hover:underline">
                    <p className="font-display font-semibold text-brand-ink">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.email}</p>
                  </a>
                  <div className="flex items-center gap-2">
                    {!i.active && <Badge variant="danger">Deactivated</Badge>}
                    {i.latestAgreement === null && <Badge variant="neutral">No agreement sent</Badge>}
                    {i.latestAgreement?.status === "PENDING" && <Badge variant="warning">Agreement pending</Badge>}
                    {i.latestAgreement?.status === "ACCEPTED" && <Badge variant="success">Agreement accepted</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {i.courseCount} course{i.courseCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-3">
                    <a href={`/admin/instructors/${i.id}`} className="font-semibold text-brand-teal hover:underline">
                      View details →
                    </a>
                    <button
                      type="button"
                      disabled={busyId === i.id}
                      onClick={() => toggleActive(i.id, !i.active)}
                      className="font-semibold text-gray-500 hover:text-brand-rose"
                    >
                      {i.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
