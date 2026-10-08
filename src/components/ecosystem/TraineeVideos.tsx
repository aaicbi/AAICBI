"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Video {
  id: string; title: string; status: string; thumbnailUrl: string; youtubeUrl: string; organizationName: string;
  submittedByTrainee: boolean; orgDecisionNote: string | null; reviewNote: string | null; escalatedAt: string | null;
}
interface Payload { enabled: boolean; organizations: Array<{ id: string; name: string }>; videos: Video[] }

const STATUS: Record<string, { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  AWAITING_ORG: { text: "Waiting for your organization", variant: "warning" },
  ORG_DECLINED: { text: "Your organization declined it", variant: "danger" },
  AWAITING_CONSENT: { text: "Waiting for your permission", variant: "warning" },
  DECLINED: { text: "You declined", variant: "neutral" },
  PENDING_REVIEW: { text: "With AAICBI for review", variant: "warning" },
  PUBLISHED: { text: "Published", variant: "success" },
  REJECTED: { text: "Not approved", variant: "danger" },
};

const EMPTY = { trainingOrganizationId: "", title: "", youtubeUrl: "", description: "", skills: "", sendTo: "organization", reason: "" };

export default function TraineeVideos() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/trainee/videos").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  if (loadError) return <ErrorState message="Could not load your videos." onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;

  const toAdmin = form.sendTo === "admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/trainee/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainingOrganizationId: form.trainingOrganizationId,
        title: form.title,
        youtubeUrl: form.youtubeUrl,
        description: form.description,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        sendTo: form.sendTo,
        reason: form.reason,
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not send the video.");
    setForm(EMPTY);
    showToast(toAdmin ? "Sent to AAICBI for review." : "Sent to your training organization for review.", "success");
    load();
  }

  async function escalate(id: string) {
    const res = await fetch(`/api/trainee/videos/${id}/escalate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(body.error ?? "Could not send it to AAICBI.", "error");
    setEscalating(null);
    setReason("");
    showToast("Sent to AAICBI for review.", "success");
    load();
  }

  async function withdraw(id: string) {
    const res = await fetch(`/api/trainee/videos/${id}`, { method: "DELETE" });
    if (!res.ok) return showToast((await res.json().catch(() => ({}))).error ?? "Could not withdraw it.", "error");
    showToast("Video withdrawn.", "success");
    load();
  }

  return (
    <div className="space-y-8">
      {!data.enabled && (
        <p role="status" className="rounded-lg bg-brand-mint px-4 py-3 text-sm text-brand-ink">Trainee videos are not switched on for the platform yet, so new videos cannot be sent. This page will work as soon as AAICBI turns them on.</p>
      )}

      <form onSubmit={submit}>
        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Share a video</h2>
          {data.organizations.length === 0 ? (
            <p className="text-sm text-gray-700">You can share a video once you are enrolled in a course from a training organization.</p>
          ) : (
            <>
              <Select label="Training organization" value={form.trainingOrganizationId} onChange={(e) => setForm({ ...form, trainingOrganizationId: e.target.value })} required>
                <option value="">Choose an organization</option>
                {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
              <Input label="Video title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} required />
              <Input label="YouTube link" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." required />
              <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
              <Input label="Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} hint="Comma separated, for example Python, Data Cleaning" />
              <Select label="Send it to" value={form.sendTo} onChange={(e) => setForm({ ...form, sendTo: e.target.value })} hint="Most videos go to your organization first. Choose AAICBI directly if you cannot reach them or have had trouble.">
                <option value="organization">My training organization</option>
                <option value="admin">AAICBI (Super Admin) directly</option>
              </Select>
              {toAdmin && <Textarea label="Why are you sending it to AAICBI? (optional)" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} />}
              {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
              <Button type="submit" loading={busy} disabled={!data.enabled || !form.trainingOrganizationId || !form.title || !form.youtubeUrl}>
                {toAdmin ? "Send to AAICBI" : "Send for review"}
              </Button>
            </>
          )}
        </Card>
      </form>

      <section aria-labelledby="my-videos">
        <h2 id="my-videos" className="font-display text-lg font-semibold text-brand-ink">Your videos</h2>
        <div className="mt-3 space-y-3">
          {data.videos.length === 0 && <EmptyState title="No videos yet" description="Videos you post, and videos your organization posts about you, show up here." />}
          {data.videos.map((v) => {
            const s = STATUS[v.status] ?? { text: v.status, variant: "neutral" as const };
            const canEscalate = v.submittedByTrainee && (v.status === "AWAITING_ORG" || v.status === "ORG_DECLINED");
            const canWithdraw = v.submittedByTrainee && (canEscalate || v.status === "PENDING_REVIEW");
            return (
              <Card key={v.id} className="space-y-3">
                <div className="flex items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
                  <img src={v.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-ink">{v.title}</p>
                    <p className="text-xs text-gray-600">{v.organizationName}{v.submittedByTrainee ? "" : " · posted by your organization"}</p>
                    {v.orgDecisionNote && <p className="mt-1 text-xs text-gray-700">Organization said: {v.orgDecisionNote}</p>}
                    {v.reviewNote && <p className="mt-1 text-xs text-gray-700">AAICBI said: {v.reviewNote}</p>}
                  </div>
                  <Badge variant={s.variant}>{s.text}</Badge>
                </div>
                {(canEscalate || canWithdraw) && escalating !== v.id && (
                  <div className="flex flex-wrap gap-2">
                    {canEscalate && <Button size="sm" variant="secondary" onClick={() => { setEscalating(v.id); setReason(""); }}>Send to AAICBI for review</Button>}
                    {canWithdraw && <Button size="sm" variant="ghost" onClick={() => withdraw(v.id)}>Withdraw</Button>}
                  </div>
                )}
                {escalating === v.id && (
                  <div className="space-y-2">
                    <Textarea label="What is the problem?" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} hint="For example: my organization has not replied, or I think the decision was unfair." />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={reason.trim().length < 5} onClick={() => escalate(v.id)}>Send to AAICBI</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEscalating(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
