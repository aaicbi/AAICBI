"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";

interface PaymentsData {
  defaultAiCreditAllowance: number;
  defaultReminderDaysBeforeExpiry: number[];
}

/**
 * Settings-page redesign, Payments category. Covers the two
 * platform-wide values that actually govern the paid-enrollment
 * lifecycle today: AI credits granted on payment, and the default
 * expiry-reminder schedule offered when creating a new fixed-duration
 * course. Also surfaces the Paystack connection status read-only, so
 * an admin looking at "Payments" settings sees at a glance whether the
 * gateway itself is even configured — the same information the
 * Integrations tab shows, repeated here because it's directly relevant
 * to everything else on this panel.
 *
 * Both editable fields live on the same `PlatformSettings` row as
 * Security's fields, but this panel only ever sends the two keys it
 * renders — see the API route's own comment on why that's safe.
 */
export default function PaymentsSettingsPanel({ viewerRole }: { viewerRole?: string }) {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [initial, setInitial] = useState<PaymentsData | null>(null);
  const [reminderDaysText, setReminderDaysText] = useState("");
  const [paystackConnected, setPaystackConnected] = useState<boolean | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    setForbidden(false);
    setData(null);
    Promise.all([
      fetch("/api/admin/platform-settings").then((r) => {
        if (r.status === 403) return "forbidden" as const;
        return r.ok ? r.json() : Promise.reject();
      }),
      fetch("/api/admin/integrations-status")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .catch(() => null),
    ])
      .then(([settings, integrations]) => {
        if (settings === "forbidden") {
          setForbidden(true);
          return;
        }
        const value: PaymentsData = {
          defaultAiCreditAllowance: settings.defaultAiCreditAllowance,
          defaultReminderDaysBeforeExpiry: settings.defaultReminderDaysBeforeExpiry,
        };
        setData(value);
        setInitial(value);
        setReminderDaysText(value.defaultReminderDaysBeforeExpiry.join(", "));
        const paystack = integrations?.integrations?.find((i: { id: string }) => i.id === "paystack");
        setPaystackConnected(paystack ? paystack.status === "connected" : null);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    if (viewerRole && viewerRole !== "SUPER_ADMIN") {
      setForbidden(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRole]);

  const parsedReminderDays = reminderDaysText
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d !== "")
    .map(Number);
  const reminderDaysValid = parsedReminderDays.every((d) => Number.isInteger(d) && d > 0);

  const dirty =
    data !== null &&
    initial !== null &&
    (data.defaultAiCreditAllowance !== initial.defaultAiCreditAllowance ||
      reminderDaysText !== initial.defaultReminderDaysBeforeExpiry.join(", "));

  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    if (!data || !reminderDaysValid) return;
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/platform-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultAiCreditAllowance: data.defaultAiCreditAllowance,
        defaultReminderDaysBeforeExpiry: parsedReminderDays,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const message =
        res.status === 403 ? "Only Super Admins can change payment settings." : "We couldn't save these settings. Please try again.";
      setSaveError(message);
      showToast(message, "error");
      return;
    }
    const updated = await res.json();
    const value: PaymentsData = {
      defaultAiCreditAllowance: updated.defaultAiCreditAllowance,
      defaultReminderDaysBeforeExpiry: updated.defaultReminderDaysBeforeExpiry,
    };
    setData(value);
    setInitial(value);
    setReminderDaysText(value.defaultReminderDaysBeforeExpiry.join(", "));
    showToast("Settings saved successfully.", "success");
  }

  function cancel() {
    if (initial) {
      setData(initial);
      setReminderDaysText(initial.defaultReminderDaysBeforeExpiry.join(", "));
    }
    setSaveError(null);
  }

  if (forbidden) {
    return (
      <Card>
        <p className="font-display font-semibold text-brand-ink">Payments</p>
        <p className="mt-2 text-sm text-gray-600">
          Only Super Admins can view or change payment settings. If you need something changed here, ask a Super
          Admin on your team.
        </p>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorState message="We couldn't load payment settings." onRetry={load} />;
  }

  if (data === null) {
    return <SkeletonList rows={2} />;
  }

  return (
    <div className="space-y-4">
      {paystackConnected !== null && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-brand-ink">Payment Gateway</p>
            <p className="mt-1 text-sm text-gray-600">Paystack — powers course checkout, subscriptions, and receipts.</p>
          </div>
          <Badge variant={paystackConnected ? "success" : "warning"}>
            {paystackConnected ? "Connected" : "Not configured"}
          </Badge>
        </Card>
      )}

      <Card>
        <p className="font-display font-semibold text-brand-ink">Default AI Study Buddy Credits</p>
        <p className="mt-1 text-sm text-gray-600">
          Granted automatically to a trainee on every successful paid enrollment or renewal, unless a specific
          course has its own override set on its own page.
        </p>
        <input
          type="number"
          min={0}
          value={data.defaultAiCreditAllowance}
          onChange={(e) => setData({ ...data, defaultAiCreditAllowance: Number(e.target.value) })}
          className="mt-4 w-40 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </Card>

      <Card>
        <p className="font-display font-semibold text-brand-ink">Default Expiry-Reminder Schedule</p>
        <p className="mt-1 text-sm text-gray-600">
          Pre-fills the reminder days shown when creating a new fixed-duration paid course — an admin can still
          change it per course. Doesn&apos;t affect any course that already exists.
        </p>
        <input
          value={reminderDaysText}
          onChange={(e) => setReminderDaysText(e.target.value)}
          placeholder="e.g. 14, 7, 1"
          className="mt-4 w-full max-w-xs rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        {!reminderDaysValid && (
          <p className="mt-1.5 text-xs text-brand-rose">Enter a comma-separated list of positive whole days, e.g. 14, 7, 1.</p>
        )}
      </Card>

      {saveError && <p className="text-sm text-brand-rose">{saveError}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty || !reminderDaysValid}>
          Save Changes
        </Button>
        {dirty && (
          <>
            <Button variant="ghost" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <span className="text-xs font-semibold text-brand-gold">Unsaved changes</span>
          </>
        )}
      </div>
    </div>
  );
}
