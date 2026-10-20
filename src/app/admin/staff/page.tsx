"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { ADMIN_NAV_STAFF } from "@/lib/admin/nav";

import { Checkbox, Select } from "@/components/ui/Field";
import AccessDenied from "@/components/ui/AccessDenied";
import { useMyAccess } from "@/lib/useMyAccess";
interface StaffDto {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR";
  canReview?: boolean;
  createdAt: string;
  active?: boolean;
  jobTitle?: string | null;
  staffNumber?: string | null;
  configured?: boolean;
}

const ROLE_LABELS: Record<StaffDto["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
};

/**
 * The real answer to "can a Super Admin open an account for a staff
 * member and give them a specific role" — this page is that answer.
 * SUPER_ADMIN only, matching the API's own scoping. Never offers
 * "Super Admin" as a role anywhere on this page, for creation or for
 * changing an existing account — the same hard boundary the API
 * enforces, shown here rather than just relied upon silently.
 */
export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffDto[] | null>(null);
  const [staffError, setStaffError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();
  const me = useMyAccess();

  function load() {
    setStaffError(false);
    fetch("/api/admin/staff")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStaff)
      .catch(() => setStaffError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, newRole: "ADMIN" | "INSTRUCTOR") {
    setBusyId(id);
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not update role. Try again.", "error");
      return;
    }
    showToast("Role updated.");
    load();
  }

  async function setReviewer(id: string, canReview: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/admin/staff/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ canReview }) });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not update reviewer access. Try again.", "error");
      return;
    }
    showToast(canReview ? "They can now review posts and Loop's questions." : "Reviewer access removed.");
    load();
  }

  if (me && !me.permissions.has("staff.accounts:view")) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_STAFF} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10"><AccessDenied what="staff accounts" /></main>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        nav={ADMIN_NAV_STAFF}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <DesktopRecommended what="Managing staff accounts" />
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Staff Accounts</h1>
          <Link href="/admin/staff/new" className="inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="add-staff">+ Add Staff</Link>
        </div>

        <div className="mt-6 space-y-3">
          {staffError ? (
            <ErrorState message="We couldn't load staff accounts." onRetry={load} />
          ) : staff === null ? (
            <SkeletonList />
          ) : (
            staff.map((s) => (
              <Card key={s.id} className="flex items-center justify-between">
                <div>
                  {s.role === "INSTRUCTOR" ? (
                    <a href={`/admin/instructors/${s.id}`} className="font-display font-semibold text-brand-ink hover:text-brand-teal hover:underline">
                      {s.name}
                    </a>
                  ) : (
                    <p className="font-display font-semibold text-brand-ink">{s.name}</p>
                  )}
                  <p className="text-xs text-gray-500">{s.email}{s.jobTitle ? ` · ${s.jobTitle}` : ""}{s.staffNumber ? ` · #${s.staffNumber}` : ""}</p>
                  {s.role !== "SUPER_ADMIN" && <p className="text-xs text-gray-600">{s.active === false ? "Suspended · " : ""}{s.configured ? "Custom permissions" : "Standard access for the account type"}</p>}
                </div>
                {s.role === "SUPER_ADMIN" ? (
                  <span className="text-xs font-semibold text-brand-teal">{ROLE_LABELS[s.role]}</span>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                  <Link href={`/admin/staff/${s.id}`} className="inline-flex min-h-[44px] items-center rounded-full border border-brand-gray px-4 text-xs font-semibold text-brand-ink hover:bg-brand-mint" data-testid={`staff-access-${s.id}`}>Access</Link>
                  <Checkbox label="Reviewer" hint="Can review posts and Loop's questions" checked={!!s.canReview} onChange={() => setReviewer(s.id, !s.canReview)} disabled={busyId === s.id} />
                  <Select label={`Role for ${s.name}`} hideLabel compact controlClassName="text-xs font-semibold" value={s.role} onChange={(e) => changeRole(s.id, e.target.value as "ADMIN" | "INSTRUCTOR")} disabled={busyId === s.id}>
                    <option value="INSTRUCTOR">Instructor</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
