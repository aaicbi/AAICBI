"use client";
import { useEffect, useState } from "react";
import FormSteps from "@/components/ui/FormSteps";
import StickyActions from "@/components/ui/StickyActions";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Ev { id: string; title: string; description: string | null; startsAt: string; endsAt: string | null; locationText: string | null; registrationUrl: string | null }
const EMPTY = { title: "", description: "", startsAt: "", endsAt: "", locationText: "", registrationUrl: "" };

/** An organization's own events. Times are entered and shown in UTC so everyone sees the same moment. */
export default function OrgEventsManager() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  function load() {
    setError(false);
    fetch("/api/org/events").then((r) => (r.ok ? r.json() : Promise.reject())).then(setEvents).catch(() => setError(true));
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const toIso = (v: string) => (v ? new Date(`${v}:00Z`).toISOString() : undefined);
    const res = await fetch("/api/org/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), locationText: form.locationText, registrationUrl: form.registrationUrl }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(typeof data.error === "string" ? data.error : "Could not save the event.", "error"); return; }
    setForm(EMPTY);
    showToast("Event published.");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/org/events/${id}`, { method: "DELETE" });
    if (!res.ok) { showToast("Could not remove the event.", "error"); return; }
    load();
  }

  return (
    <div className="space-y-8">
      <Card>
        <form onSubmit={create}>
          <FormSteps
            className="space-y-3"
            labels={["What and when", "Where and how"]}
            footer={<StickyActions><Button type="submit" loading={busy}>Publish event</Button></StickyActions>}
          >
            <div className="space-y-3">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Starts (UTC)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
                <Input label="Ends (UTC, optional)" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              <Input label="Place (optional, e.g. Lagos or Online)" value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value })} maxLength={160} />
              <Input label="Registration link (optional, https only)" type="url" value={form.registrationUrl} onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })} placeholder="https://" />
              <Textarea label="Details (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={1000} />
            </div>
          </FormSteps>
        </form>
      </Card>
      {error ? <ErrorState message="Could not load your events." onRetry={load} /> : events === null ? <SkeletonList rows={2} /> : events.length === 0 ? (
        <EmptyState title="No events yet" description="Events you publish appear on your public page and in /events." />
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-ink">{ev.title}</p>
                  <p className="text-xs text-gray-600">{new Date(ev.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC{ev.locationText ? ` • ${ev.locationText}` : ""}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => remove(ev.id)}>Remove</Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
