"use client";
import { useEffect, useState } from "react";
import FormSteps from "@/components/ui/FormSteps";
import StickyActions from "@/components/ui/StickyActions";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface PostRow {
  id: string; title: string; status: string; thumbnailUrl: string; viewCount: number; createdAt: string; reviewNote: string | null;
  youtubeUrl: string; description: string | null; submittedByTrainee: boolean; orgDecisionNote: string | null; escalatedAt: string | null;
  trainee: { name: string }; course: { title: string } | null;
}
interface Payload {
  posts: PostRow[]; trainees: Array<{ id: string; name: string }>; courses: Array<{ id: string; title: string }>; verified: boolean; enabled: boolean;
}
interface Preview { id: string; thumbnailUrl: string; title: string | null }

const STATUS_LABEL: Record<string, { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  AWAITING_CONSENT: { text: "Waiting for trainee", variant: "warning" },
  AWAITING_ORG: { text: "Waiting for your decision", variant: "warning" },
  ORG_DECLINED: { text: "You declined", variant: "danger" },
  DECLINED: { text: "Trainee declined", variant: "danger" },
  PENDING_REVIEW: { text: "In review", variant: "warning" },
  PUBLISHED: { text: "Published", variant: "success" },
  REJECTED: { text: "Not approved", variant: "danger" },
  REMOVED: { text: "Removed", variant: "neutral" },
};

export default function OrgEducationManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ traineeId: "", title: "", youtubeUrl: "", description: "", courseId: "", moduleName: "", skills: "" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  function load() {
    setLoadError(false);
    fetch("/api/org/education-posts").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }
  useEffect(load, []);

  if (loadError) return <ErrorState message="Could not load your videos." onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;

  async function checkLink() {
    setError(null);
    setPreview(null);
    const res = await fetch("/api/org/education-posts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ youtubeUrl: form.youtubeUrl }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "That link did not work.");
    setPreview(body);
    if (!form.title && body.title) setForm((f) => ({ ...f, title: body.title }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/org/education-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traineeId: form.traineeId,
        title: form.title,
        youtubeUrl: form.youtubeUrl,
        description: form.description,
        courseId: form.courseId || null,
        moduleName: form.moduleName,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not publish.");
    showToast("Sent to the trainee for consent.", "success");
    setForm({ traineeId: "", title: "", youtubeUrl: "", description: "", courseId: "", moduleName: "", skills: "" });
    setPreview(null);
    load();
  }

  async function withdraw(id: string) {
    const res = await fetch(`/api/org/education-posts/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else showToast("Could not remove that video.", "error");
  }

  return (
    <div className="space-y-8">
      {!data.enabled && (
        <p className="rounded-lg border border-brand-gray bg-brand-sand/60 p-3 text-sm text-gray-700">
          Education videos are not switched on for the platform yet, so new videos cannot be sent. This page will work as soon as AAICBI enables it.
        </p>
      )}
      <form onSubmit={submit}>
        <Card className="space-y-4">
          <p className="text-xs text-gray-600">
            {data.verified ? "Your organization is verified: videos publish as soon as the trainee agrees." : "Videos are reviewed by AAICBI after the trainee agrees."}
          </p>
          <FormSteps
            className="space-y-4"
            labels={["Trainee and video", "Details"]}
            footer={
              <div className="space-y-3">
                {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
                <StickyActions>
                  <Button type="submit" loading={busy} disabled={!data.enabled || !form.traineeId || !form.title || !form.youtubeUrl}>Send for trainee consent</Button>
                </StickyActions>
              </div>
            }
          >
            <div className="space-y-4">
          <Select label="Trainee" required value={form.traineeId} onChange={(e) => setForm({ ...form, traineeId: e.target.value })} hint="Only trainees enrolled in your programs are listed.">
            <option value="">Choose a trainee</option>
            {data.trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <div className="flex items-end gap-2">
            <Input wrapperClassName="flex-1" label="YouTube link" required value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
            <Button type="button" variant="secondary" onClick={checkLink} disabled={!form.youtubeUrl}>Check link</Button>
          </div>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail for the preview.
            <img src={preview.thumbnailUrl} alt="Video thumbnail" className="aspect-video w-full max-w-sm rounded-lg object-cover" />
          )}
          <Input label="Video title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} />
            </div>
            <div className="space-y-4">
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Program" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">None</option>
              {data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Input label="Module" value={form.moduleName} onChange={(e) => setForm({ ...form, moduleName: e.target.value })} maxLength={120} />
          </div>
          <Input label="Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} hint="Comma separated, for example Python, Data Cleaning" />
            </div>
          </FormSteps>
        </Card>
      </form>

      {data.posts.some((p) => p.status === "AWAITING_ORG" && p.submittedByTrainee) && (
        <section aria-labelledby="trainee-sent">
          <h2 id="trainee-sent" className="font-display text-lg font-semibold text-brand-ink">Videos trainees sent you</h2>
          <p className="text-sm text-gray-600">Trainees posted these themselves. Approve to publish (or send on for AAICBI&apos;s check if your organization is not verified), or decline with a short reason.</p>
          <div className="mt-3 space-y-3">
            {data.posts.filter((p) => p.status === "AWAITING_ORG" && p.submittedByTrainee).map((p) => (
              <SubmissionRow key={p.id} p={p} onDecide={async (action, note) => {
                const res = await fetch(`/api/org/education-posts/${p.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
                if (!res.ok) showToast((await res.json().catch(() => ({}))).error ?? "Could not save your decision.", "error");
                else showToast(action === "approve" ? "Video approved." : "Video declined. The trainee has been told why.", "success");
                load();
              }} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="your-videos">
        <h2 id="your-videos" className="font-display text-lg font-semibold text-brand-ink">Your videos</h2>
        <div className="mt-3 space-y-3">
          {data.posts.length === 0 && <p className="text-sm text-gray-600">No videos yet.</p>}
          {data.posts.map((p) => {
            const s = STATUS_LABEL[p.status] ?? { text: p.status, variant: "neutral" as const };
            return (
              <Card key={p.id} className="flex flex-wrap items-center gap-3 sm:gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
                <img src={p.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-semibold text-brand-ink">{p.title}</p>
                  <p className="text-xs text-gray-600">{p.trainee.name}{p.course ? ` · ${p.course.title}` : ""} · {p.viewCount} views</p>
                  {p.reviewNote && <p className="text-xs text-gray-600">Note: {p.reviewNote}</p>}
                </div>
                <Badge variant={s.variant}>{s.text}</Badge>
                {p.status !== "REMOVED" && <Button size="sm" variant="ghost" onClick={() => withdraw(p.id)}>Remove</Button>}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SubmissionRow({ p, onDecide }: { p: PostRow; onDecide: (action: "approve" | "decline", note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  async function go(action: "approve" | "decline") {
    setBusy(action);
    await onDecide(action, note);
    setBusy(null);
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
        <img src={p.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-ink">{p.title}</p>
          <p className="text-xs text-gray-600">From {p.trainee.name}{p.course ? ` · ${p.course.title}` : ""}</p>
          {p.description && <p className="mt-1 text-sm text-gray-700">{p.description}</p>}
          <a href={p.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-teal hover:underline">Watch on YouTube</a>
        </div>
      </div>
      <Input label="Note to the trainee (needed if you decline)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <div className="flex gap-2">
        <Button size="sm" loading={busy === "approve"} disabled={busy !== null} onClick={() => go("approve")}>Approve</Button>
        <Button size="sm" variant="secondary" loading={busy === "decline"} disabled={busy !== null || note.trim().length < 3} onClick={() => go("decline")}>Decline</Button>
      </div>
    </Card>
  );
}
