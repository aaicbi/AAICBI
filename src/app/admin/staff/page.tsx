"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface StaffDto {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR";
  createdAt: string;
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "INSTRUCTOR">("INSTRUCTOR");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

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

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not create account. Try again.", "error");
      return;
    }
    setName("");
    setEmail("");
    setRole("INSTRUCTOR");
    setShowAddForm(false);
    showToast("Account created — they'll receive an email to set their password.");
    load();
  }

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

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-brand-ink">Staff Accounts</h1>
          {!showAddForm && <Button onClick={() => setShowAddForm(true)}>+ Add Staff</Button>}
        </div>

        {showAddForm && (
          <Card className="mt-4">
            <form onSubmit={createStaff} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                required
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                aria-label="Work email"
                required
                className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <div>
                <label className="text-xs font-semibold text-gray-600">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "INSTRUCTOR")}
                  className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
                >
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                They&apos;ll receive an email with a link to set their own password.
              </p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={creating}>
                  Create Account
                </Button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-xs font-semibold text-gray-500">
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {staffError ? (
            <ErrorState message="We couldn't load staff accounts." onRetry={load} />
          ) : staff === null ? (
            <SkeletonList />
          ) : (
            staff.map((s) => (
              <Card key={s.id} className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
                {s.role === "SUPER_ADMIN" ? (
                  <span className="text-xs font-semibold text-brand-teal">{ROLE_LABELS[s.role]}</span>
                ) : (
                  <select
                    value={s.role}
                    onChange={(e) => changeRole(s.id, e.target.value as "ADMIN" | "INSTRUCTOR")}
                    disabled={busyId === s.id}
                    className="rounded-lg border border-brand-gray px-2 py-1.5 text-xs font-semibold outline-none focus:border-brand-teal"
                  >
                    <option value="INSTRUCTOR">Instructor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
