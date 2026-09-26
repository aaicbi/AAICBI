"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

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
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Pitches", href: "/admin/pitches" },
          { label: "Pitch Cohorts", href: "/admin/pitch-cohorts" },
          { label: "Investors", href: "/admin/investors" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
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

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-gray text-gray-500">
                <th className="py-2">Founder</th>
                <th>Pitch</th>
                <th>Funding</th>
                <th>Cohort</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <SkeletonTableRows rows={5} cols={5} />
              ) : data.pitches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No pitches yet.
                  </td>
                </tr>
              ) : (
                data.pitches.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                    onClick={() => (window.location.href = `/admin/pitches/${p.id}`)}
                  >
                    <td className="py-2">
                      <div className="font-medium text-brand-ink">{p.trainee.name}</div>
                      <div className="text-xs text-gray-500">{p.trainee.email}</div>
                    </td>
                    <td>{p.startupName}</td>
                    <td>{p.fundingAmountKobo != null ? `₦${(p.fundingAmountKobo / 100).toLocaleString()}` : "—"}</td>
                    <td className="text-xs text-gray-500">{p.cohort?.name ?? "—"}</td>
                    <td>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
