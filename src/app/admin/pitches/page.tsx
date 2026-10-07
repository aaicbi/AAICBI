"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DataTable from "@/components/ui/DataTable";
import { ADMIN_NAV_PITCH } from "@/lib/admin/nav";

interface PitchRow {
  id: string;
  startupName: string;
  status: "SUBMITTED" | "NEEDS_REVISION" | "APPROVED" | "REJECTED" | "PUBLISHED";
  fundingAmountKobo: number | null;
  createdAt: string;
  trainee: { name: string; email: string };
  cohort: { id: string; name: string } | null;
}

interface PitchesResponse {
  summary: { pending: number; needsRevision: number; approved: number; published: number; investorInterest: number };
  pitches: PitchRow[];
}

const STATUS_LABEL: Record<PitchRow["status"], string> = {
  SUBMITTED: "Under Review",
  NEEDS_REVISION: "Needs Revision",
  APPROVED: "Approved",
  REJECTED: "Not Approved",
  PUBLISHED: "Published",
};

const STATUS_VARIANT: Record<PitchRow["status"], "warning" | "success" | "danger" | "gold"> = {
  SUBMITTED: "warning",
  NEEDS_REVISION: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  PUBLISHED: "gold",
};

/**
 * /admin/pitches — the Pitch Review Center. Same card-plus-table
 * pattern as /admin/exams/[id]/results, so it reads as a native part of
 * this admin surface rather than a bolted-on new tool.
 */
export default function AdminPitchesPage() {
  const [data, setData] = useState<PitchesResponse | null>(null);

  useEffect(() => {
    fetch("/api/admin/pitches")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const cards: [string, number][] = data
    ? [
        ["Pending Review", data.summary.pending],
        ["Needs Revision", data.summary.needsRevision],
        ["Approved", data.summary.approved],
        ["Published", data.summary.published],
        ["Investor Interest", data.summary.investorInterest],
      ]
    : [];

  return (
    <>
      <SiteHeader
        nav={ADMIN_NAV_PITCH}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Pitch Review Center</h1>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {!data
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-brand-gray/30" />)
            : cards.map(([label, value]) => (
                <Card key={label} variant="highlighted" className="p-4">
                  <div className="font-display text-2xl font-semibold text-brand-teal">{value}</div>
                  <div className="text-xs text-gray-600">{label}</div>
                </Card>
              ))}
        </div>

        <div className="mt-6">
          <DataTable
            caption="Submitted pitches"
            rows={data ? data.pitches : null}
            rowKey={(p) => p.id}
            onRowClick={(p) => (window.location.href = `/admin/pitches/${p.id}`)}
            searchLabel="Search founders or pitches"
            searchText={(p) => `${p.trainee.name} ${p.trainee.email} ${p.startupName}`}
            empty={<p className="py-6 text-center text-gray-600">No pitches yet.</p>}
            columns={[
              {
                key: "founder",
                header: "Founder",
                sortValue: (p) => p.trainee.name,
                render: (p) => (
                  <div>
                    <div className="font-medium text-brand-ink">{p.trainee.name}</div>
                    <div className="text-xs font-normal text-gray-600">{p.trainee.email}</div>
                  </div>
                ),
              },
              { key: "pitch", header: "Pitch", sortValue: (p) => p.startupName, render: (p) => p.startupName },
              {
                key: "funding",
                header: "Funding",
                sortValue: (p) => p.fundingAmountKobo,
                render: (p) => (p.fundingAmountKobo != null ? `₦${(p.fundingAmountKobo / 100).toLocaleString()}` : "—"),
              },
              { key: "cohort", header: "Cohort", className: "text-xs text-gray-600", sortValue: (p) => p.cohort?.name ?? null, render: (p) => p.cohort?.name ?? "—" },
              {
                key: "status",
                header: "Status",
                sortValue: (p) => STATUS_LABEL[p.status],
                render: (p) => <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>,
              },
            ]}
          />
        </div>
      </main>
    </>
  );
}
