"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Row { id: string; title: string; description: string | null; thumbnailUrl: string; status: string; organizationName: string }

export default function TraineeConsentList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/trainee/education-consents").then((r) => (r.ok ? r.json() : Promise.reject())).then(setRows).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function answer(id: string, decision: "grant" | "decline" | "withdraw") {
    setBusyId(id);
    const res = await fetch(`/api/trainee/education-consents/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    setBusyId(null);
    if (!res.ok) return showToast((await res.json().catch(() => ({}))).error ?? "Could not save your answer.", "error");
    showToast("Saved.", "success");
    load();
  }

  if (loadError) return <ErrorState message="Could not load your requests." onRetry={load} />;
  if (!rows) return <SkeletonList rows={3} />;
  if (rows.length === 0) return <EmptyState title="No requests" description="When an organization wants to feature you in a video, it appears here." />;

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Card key={r.id} className="space-y-3">
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
            <img src={r.thumbnailUrl} alt="" className="h-20 w-36 shrink-0 rounded object-cover" />
            <div>
              <p className="font-semibold text-brand-ink">{r.title}</p>
              <p className="text-sm text-gray-600">Requested by {r.organizationName}</p>
              {r.description && <p className="mt-1 text-sm text-gray-700">{r.description}</p>}
            </div>
          </div>
          {r.status === "AWAITING_CONSENT" ? (
            <div className="flex gap-2">
              <Button size="sm" loading={busyId === r.id} onClick={() => answer(r.id, "grant")}>Allow</Button>
              <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => answer(r.id, "decline")}>Decline</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant={r.status === "PUBLISHED" ? "success" : r.status === "PENDING_REVIEW" ? "warning" : "neutral"}>
                {r.status === "PUBLISHED" ? "Public" : r.status === "PENDING_REVIEW" ? "Allowed, awaiting review" : r.status === "DECLINED" ? "Declined" : r.status === "REMOVED" ? "Removed" : "Not approved"}
              </Badge>
              {["PUBLISHED", "PENDING_REVIEW", "REJECTED"].includes(r.status) && (
                <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => answer(r.id, "withdraw")}>Withdraw permission</Button>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
