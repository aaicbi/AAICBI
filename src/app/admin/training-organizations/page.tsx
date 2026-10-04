"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

interface TrainingOrgDto {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedBy: { name: string } | null;
  certificateTemplates: { id: string; name: string; approvedAt: string | null }[];
}

/**
 * Training Organizations, Phase 1 — the review queue, same Pending
 * Review / Previously Decided shape as /admin/employers. No per-page
 * SiteHeader call — new pages built after the admin sidebar rollout
 * don't need one; the sidebar provides navigation.
 */
export default function AdminTrainingOrganizationsPage() {
  const [orgs, setOrgs] = useState<TrainingOrgDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/admin/training-organizations")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOrgs)
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/training-organizations/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      showToast("Could not complete that action. Try again.", "error");
      return;
    }
    showToast(action === "APPROVE" ? "Organization approved." : "Organization rejected.");
    load();
  }

  const pending = orgs?.filter((o) => o.approvalState === "PENDING") ?? [];
  const decided = orgs?.filter((o) => o.approvalState !== "PENDING") ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Training Organizations</h1>

      <h2 className="mt-6 text-sm font-semibold text-gray-500">Pending Review ({pending.length})</h2>
      <div className="mt-2 space-y-3">
        {loadError ? (
          <ErrorState message="We couldn't load training organizations." onRetry={load} />
        ) : orgs === null ? (
          <SkeletonList />
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing waiting on review.</p>
        ) : (
          pending.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                  <p className="text-xs text-gray-500">
                    {o.contactName} · {o.email}
                    {o.phone && ` · ${o.phone}`}
                  </p>
                  {o.website && (
                    <a href={o.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-teal hover:underline">
                      Website
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => decide(o.id, "APPROVE")} loading={busyId === o.id}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(o.id, "REJECT")} loading={busyId === o.id}>
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-gray-500">Previously Decided</h2>
          <div className="mt-2 space-y-3">
            {decided.map((o) => (
              <Card key={o.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                    <p className="text-xs text-gray-500">
                      {o.contactName} · {o.email}
                      {o.approvedBy && ` · decided by ${o.approvedBy.name}`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${o.approvalState === "APPROVED" ? "text-brand-teal" : "text-brand-rose"}`}>
                    {o.approvalState === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                </div>
                {o.approvalState === "APPROVED" && (
                  <a
                    href={`/admin/training-organizations/${o.id}/certificate-templates`}
                    className="mt-3 inline-block text-xs font-semibold text-brand-teal hover:underline"
                  >
                    Manage certificate templates
                    {o.certificateTemplates.length > 0 && ` (${o.certificateTemplates.length})`} →
                  </a>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
