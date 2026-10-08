"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Payload {
  organizations: Array<{ id: string; name: string }>;
  categories: Array<{ value: string; label: string }>;
  reports: Array<{ id: string; category: string; status: string; createdAt: string; organizationName: string }>;
}

const STATUS: Record<string, { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  OPEN: { text: "Received", variant: "neutral" },
  IN_REVIEW: { text: "Being looked at", variant: "warning" },
  RESOLVED: { text: "Resolved", variant: "success" },
  DISMISSED: { text: "Closed", variant: "neutral" },
};

export default function TraineeOrgReport() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ trainingOrganizationId: "", category: "", details: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/trainee/org-reports").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  if (loadError) return <ErrorState message="Could not load this page." onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/trainee/org-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not send your report.");
    setForm({ trainingOrganizationId: "", category: "", details: "" });
    showToast("Report sent to the Super Admin.", "success");
    load();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={submit}>
        <Card className="space-y-4">
          {data.organizations.length === 0 ? (
            <p className="text-sm text-gray-700">You can report an organization once you are enrolled in one of its courses. For anything else, use <strong>Message the Super Admin</strong> in Settings.</p>
          ) : (
            <>
              <Select label="Organization" value={form.trainingOrganizationId} onChange={(e) => setForm({ ...form, trainingOrganizationId: e.target.value })} required>
                <option value="">Choose an organization</option>
                {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
              <Select label="What happened?" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Choose one</option>
                {data.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Textarea label="Tell us what happened" rows={6} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} maxLength={2000} required hint="Say who, when and what. At least 20 characters. Do not include passwords or card numbers." />
              {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
              <Button type="submit" loading={busy} disabled={!form.trainingOrganizationId || !form.category || form.details.trim().length < 20}>Send report</Button>
              <p className="text-xs text-gray-600">If you are in danger, contact your local emergency services first.</p>
            </>
          )}
        </Card>
      </form>

      {data.reports.length > 0 && (
        <section aria-labelledby="my-reports">
          <h2 id="my-reports" className="font-display text-lg font-semibold text-brand-ink">Your reports</h2>
          <div className="mt-3 space-y-3">
            {data.reports.map((r) => {
              const s = STATUS[r.status] ?? STATUS.OPEN;
              return (
                <Card key={r.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-brand-ink">{r.organizationName}</p>
                    <p className="text-xs text-gray-600">{data.categories.find((c) => c.value === r.category)?.label ?? r.category} · {new Date(r.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
                  </div>
                  <Badge variant={s.variant}>{s.text}</Badge>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
