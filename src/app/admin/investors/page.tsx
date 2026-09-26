"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface InvestorDto {
  id: string;
  name: string;
  email: string;
  organization: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Pitch & Post, Phase 1 — the investor pool. No approve/reject queue
 * here (unlike Employers): an admin creating the account IS the vetting
 * step for this phase, since there's no self-registration path yet. A
 * setup-link email (POST /api/admin/investors) is how the investor gets
 * a usable password — same mechanism as /admin/staff.
 */
export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState<InvestorDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", organization: "", phone: "", linkedinUrl: "" });
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/admin/investors")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInvestors)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name.trim() || !form.email.trim() || !form.organization.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/investors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Could not create that investor account.", "error");
      return;
    }
    showToast("Investor account created — a setup link was emailed to them.", "success");
    setForm({ name: "", email: "", organization: "", phone: "", linkedinUrl: "" });
    load();
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Pitches", href: "/admin/pitches" },
          { label: "Investors", href: "/admin/investors" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Investor Accounts</h1>
        <p className="mt-1 text-sm text-gray-500">Create an account for a vetted investor. They'll get an email to set their own password.</p>

        <Card className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add an Investor</p>
          <div className="mt-3 space-y-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              value={form.organization}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              placeholder="Organization"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              value={form.linkedinUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
              placeholder="LinkedIn URL (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <Button size="sm" onClick={create} loading={creating}>
              Create Investor Account
            </Button>
          </div>
        </Card>

        <h2 className="mt-8 text-sm font-semibold text-gray-500">Existing Investors</h2>
        <div className="mt-2 space-y-3">
          {loadError ? (
            <ErrorState message="We couldn't load investors." onRetry={load} />
          ) : investors === null ? (
            <SkeletonList />
          ) : investors.length === 0 ? (
            <p className="text-sm text-gray-500">No investor accounts yet.</p>
          ) : (
            investors.map((inv) => (
              <Card key={inv.id} className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{inv.name}</p>
                  <p className="text-xs text-gray-500">
                    {inv.organization} · {inv.email}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${inv.active ? "text-brand-teal" : "text-brand-rose"}`}>
                  {inv.active ? "Active" : "Inactive"}
                </span>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
