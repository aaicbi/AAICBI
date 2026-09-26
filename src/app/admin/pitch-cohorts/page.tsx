"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface CohortDto {
  id: string;
  name: string;
  submissionDeadline: string | null;
  publishedAt: string | null;
  _count: { pitches: number };
}

export default function AdminPitchCohortsPage() {
  const [cohorts, setCohorts] = useState<CohortDto[] | null>(null);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const { showToast } = useToast();

  function load() {
    fetch("/api/admin/pitch-cohorts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCohorts)
      .catch(() => setCohorts([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/pitch-cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, submissionDeadline: deadline ? new Date(deadline).toISOString() : undefined }),
    });
    setCreating(false);
    if (!res.ok) {
      showToast("Could not create that cohort.", "error");
      return;
    }
    setName("");
    setDeadline("");
    load();
  }

  async function publish(id: string) {
    setPublishingId(id);
    const res = await fetch(`/api/admin/pitch-cohorts/${id}/publish`, { method: "POST" });
    setPublishingId(null);
    if (!res.ok) {
      showToast("Could not publish this cohort.", "error");
      return;
    }
    const data = await res.json();
    showToast(`Published ${data.published} pitch(es).`, "success");
    load();
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Pitches", href: "/admin/pitches" },
          { label: "Pitch Cohorts", href: "/admin/pitch-cohorts" },
          { label: "Investors", href: "/admin/investors" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Pitch Cohorts</h1>
        <p className="mt-1 text-sm text-gray-500">Batch approved pitches into a cohort, then publish it — every approved pitch in it goes live at once.</p>

        <Card className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New Cohort</p>
          <div className="mt-3 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Venture Track — Cohort 3"
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <Button size="sm" onClick={create} loading={creating}>
              Create Cohort
            </Button>
          </div>
        </Card>

        <div className="mt-6 space-y-3">
          {cohorts === null ? (
            <SkeletonList />
          ) : cohorts.length === 0 ? (
            <p className="text-sm text-gray-500">No cohorts yet.</p>
          ) : (
            cohorts.map((c) => (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-brand-ink">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c._count.pitches} pitch{c._count.pitches === 1 ? "" : "es"}
                    {c.submissionDeadline && ` · deadline ${new Date(c.submissionDeadline).toLocaleDateString()}`}
                  </p>
                </div>
                {c.publishedAt ? (
                  <Badge variant="gold">Published</Badge>
                ) : (
                  <Button size="sm" onClick={() => publish(c.id)} loading={publishingId === c.id}>
                    Publish (Demo Day)
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
