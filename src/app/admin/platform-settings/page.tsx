"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * M45 — SUPER_ADMIN-only, genuinely separate from /admin/settings
 * (M47's personal staff preferences — an AI toggle, dark mode). This
 * is a platform-wide value, not a personal one, and deserves its own
 * clearly-scoped page rather than being folded into a page about
 * individual preferences.
 */
export default function PlatformSettingsPage() {
  const [allowance, setAllowance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setAllowance(data.defaultAiCreditAllowance))
      .catch(() => setAllowance(0));
  }, []);

  async function save() {
    if (allowance === null) return;
    setSaving(true);
    const res = await fetch("/api/admin/platform-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAiCreditAllowance: allowance }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Could not save. Try again.", "error");
      return;
    }
    showToast("Saved.", "success");
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
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Platform Settings</h1>

        <Card className="mt-6">
          <p className="font-display font-semibold text-brand-ink">Default AI Study Buddy Credits</p>
          <p className="mt-1 text-sm text-gray-600">
            Granted automatically to a trainee on every successful paid enrollment or renewal, unless a specific
            course has its own override set on its own page.
          </p>
          {allowance !== null && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={allowance}
                onChange={(e) => setAllowance(Number(e.target.value))}
                className="w-32 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <Button onClick={save} loading={saving}>
                Save
              </Button>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
