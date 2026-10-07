"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface PostRow {
  id: string; title: string; status: string; thumbnailUrl: string; viewCount: number; createdAt: string; reviewNote: string | null;
  trainee: { name: string }; course: { title: string } | null;
}
interface Payload {
  posts: PostRow[]; trainees: Array<{ id: string; name: string }>; courses: Array<{ id: string; title: string }>; verified: boolean; enabled: boolean;
}
interface Preview { id: string; thumbnailUrl: string; title: string | null }

const STATUS_LABEL: Record<string, { text: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  AWAITING_CONSENT: { text: "Waiting for trainee", variant: "warning" },
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
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Program" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">None</option>
              {data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Input label="Module" value={form.moduleName} onChange={(e) => setForm({ ...form, moduleName: e.target.value })} maxLength={120} />
          </div>
          <Input label="Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} hint="Comma separated, for example Python, Data Cleaning" />
          {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
          <Button type="submit" loading={busy} disabled={!data.enabled || !form.traineeId || !form.title || !form.youtubeUrl}>Send for trainee consent</Button>
        </Card>
      </form>

      <section aria-labelledby="your-videos">
        <h2 id="your-videos" className="font-display text-lg font-semibold text-brand-ink">Your videos</h2>
        <div className="mt-3 space-y-3">
          {data.posts.length === 0 && <p className="text-sm text-gray-600">No videos yet.</p>}
          {data.posts.map((p) => {
            const s = STATUS_LABEL[p.status] ?? { text: p.status, variant: "neutral" as const };
            return (
              <Card key={p.id} className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
                <img src={p.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
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
