"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import EventCard, { type CardEvent } from "@/components/events/EventCard";
import {
  AUDIENCES, AUDIENCE_LABEL, COMMON_ZONES, DELIVERIES, DELIVERY_LABEL, EVENT_TYPES, LIMITS, MEDIA_RULES, REGISTRATION_MODES, REGISTRATION_MODE_LABEL, detectProvider, embedFor, checkHttpsUrl,
  mediaPrefix, validateEvent, validZone, zonedToUtc, expandRecurrence, FREQ_LABEL, formatDay, type Recurrence, type RepeatFreq, type Audience, type Delivery, type RegistrationMode, type TargetInput,
} from "@/lib/events/eventsCore";
import type { EventView } from "@/lib/events/events";

interface Option { id: string; name?: string; title?: string }
interface AudienceOptions { courses: Option[]; cohorts: Option[]; trainees: Option[]; organizations: Option[] }
interface Category { id: string; name: string }

export interface FormState {
  title: string; summary: string; description: string; categoryId: string; eventType: string;
  startLocal: string; endLocal: string; timeZone: string; registrationDeadlineLocal: string; capacity: string;
  delivery: Delivery; venueName: string; address: string; city: string; state: string; directions: string; mapUrl: string; attendanceNotes: string;
  meetingUrl: string; meetingId: string; passcode: string; clearPasscode: boolean; joinInstructions: string; joinOpensMinutes: string;
  audience: Audience; targets: TargetInput[]; registrationMode: RegistrationMode; registrationNotes: string; registrationUrl: string; hybridSeparateRegistration: boolean;
  flyerUrl: string; videoUrl: string; media: { kind: "POSTER" | "IMAGE" | "VIDEO"; url: string; mimeType: string | null; sizeBytes: number | null; caption: string | null }[];
  organizationId: string;
}

const EMPTY: FormState = {
  title: "", summary: "", description: "", categoryId: "", eventType: "OTHER", startLocal: "", endLocal: "", timeZone: "Africa/Lagos", registrationDeadlineLocal: "", capacity: "",
  delivery: "PHYSICAL", venueName: "", address: "", city: "", state: "", directions: "", mapUrl: "", attendanceNotes: "", meetingUrl: "", meetingId: "", passcode: "", clearPasscode: false,
  joinInstructions: "", joinOpensMinutes: "", audience: "PRIVATE", targets: [], registrationMode: "OPEN", registrationNotes: "", registrationUrl: "", hybridSeparateRegistration: false,
  flyerUrl: "", videoUrl: "", media: [], organizationId: "",
};

export interface FormInitial {
  event: EventView;
  join: { meetingUrl: string; meetingId: string | null; instructions: string | null; hasPasscode: boolean } | null;
}

export function stateFrom(i: FormInitial | null): FormState {
  if (!i) return EMPTY;
  const e = i.event;
  return {
    ...EMPTY, title: e.title, summary: e.summary ?? "", description: e.description ?? "", categoryId: e.category?.id ?? "", eventType: e.eventType, startLocal: e.startLocal, endLocal: e.endLocal, timeZone: e.timeZone,
    registrationDeadlineLocal: e.registrationDeadlineLocal ?? "", capacity: e.capacity === null ? "" : String(e.capacity), delivery: e.delivery, venueName: e.venueName ?? "", address: e.address ?? "", city: e.city ?? "",
    state: e.state ?? "", directions: e.directions ?? "", mapUrl: e.mapUrl ?? "", attendanceNotes: e.attendanceNotes ?? "", meetingUrl: i.join?.meetingUrl ?? "", meetingId: i.join?.meetingId ?? "",
    joinInstructions: i.join?.instructions ?? "", joinOpensMinutes: e.joinOpensMinutes === null ? "" : String(e.joinOpensMinutes), audience: e.audience,
    targets: (e.managed?.targets ?? []).map((t) => ({ kind: t.kind as TargetInput["kind"], refId: t.refId })), registrationMode: e.registrationMode, registrationNotes: e.registrationNotes ?? "", registrationUrl: e.registrationUrl ?? "",
    hybridSeparateRegistration: e.hybridSeparateRegistration, flyerUrl: e.flyerUrl ?? "", videoUrl: e.videoUrl ?? "",
    media: e.media.filter((m) => m.kind === "POSTER" || m.kind === "IMAGE" || m.kind === "VIDEO").map((m) => ({ kind: m.kind as "POSTER" | "IMAGE" | "VIDEO", url: m.url, mimeType: m.mimeType, sizeBytes: null, caption: m.caption })),
    organizationId: e.organizer.kind === "ORGANIZATION" ? e.organizer.id ?? "" : "",
  };
}

const STEPS = ["Basics", "Date and time", "Place or link", "Flyer and video", "Audience", "Registration", "Preview"] as const;
const FIELD_STEP: Record<string, number> = {
  recurrence: 1,
  title: 0, summary: 0, description: 0, categoryId: 0, eventType: 0, organizationId: 0,
  startLocal: 1, endLocal: 1, timeZone: 1, registrationDeadlineLocal: 1,
  venueName: 2, address: 2, mapUrl: 2, meetingUrl: 2, meetingId: 2, passcode: 2, joinInstructions: 2, joinOpensMinutes: 2,
  flyerUrl: 3, videoUrl: 3, media: 3, audience: 4, targets: 4, registrationMode: 5, capacity: 5, registrationUrl: 5,
};

/** The payload the server expects: the form's strings turned into the event input. The passcode is only sent when it was typed or cleared. */
function payload(f: FormState) {
  const data: Record<string, unknown> = { ...f };
  delete data.clearPasscode; delete data.organizationId;
  if (f.clearPasscode) data.passcode = ""; else if (!f.passcode) delete data.passcode;
  return data;
}

const hint = "text-xs text-gray-600";

export default function EventForm({
  scope, apiBase, uiBase, eventId, initial, canSubmitPromotion, canPublish, canUpload, hasPasscode = false, orgName,
}: {
  scope: "platform" | "organization"; apiBase: string; uiBase: string; eventId?: string; initial: FormInitial | null; canSubmitPromotion: boolean; canPublish: boolean; canUpload: boolean; hasPasscode?: boolean; orgName?: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [f, setF] = useState<FormState>(() => stateFrom(initial));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [opts, setOpts] = useState<AudienceOptions | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [traineeQuery, setTraineeQuery] = useState("");
  const [uploadsOn, setUploadsOn] = useState<boolean | null>(null);
  const [repeat, setRepeat] = useState<{ freq: "NONE" | RepeatFreq; weekdays: number[]; ends: "count" | "until"; count: string; until: string }>({ freq: "NONE", weekdays: [], ends: "count", count: "8", until: "" });
  const top = useRef<HTMLDivElement>(null);
  const existing = !!eventId;
  const scheduled = initial?.event.status === "SCHEDULED";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => { if (!e[k as string]) return e; const n = { ...e }; delete n[k as string]; return n; }); };

  useEffect(() => { fetch("/api/events/upload-token").then((r) => (r.ok ? r.json() : null)).then((j) => setUploadsOn(j ? !!j.available : null)).catch(() => setUploadsOn(null)); }, []);
  useEffect(() => { fetch("/api/events/categories").then((r) => (r.ok ? r.json() : null)).then((j) => j && setCategories(j.categories)).catch(() => undefined); }, []);
  useEffect(() => {
    const q = scope === "platform" && f.organizationId ? `?org=${encodeURIComponent(f.organizationId)}` : "";
    fetch(`${apiBase}/audience${q}`).then((r) => (r.ok ? r.json() : null)).then((j) => j && setOpts(j)).catch(() => undefined);
  }, [apiBase, scope, f.organizationId]);

  const online = f.delivery !== "PHYSICAL", physical = f.delivery !== "ONLINE";
  const provider = useMemo(() => { const c = checkHttpsUrl(f.meetingUrl); return c.ok ? detectProvider(c.host) : null; }, [f.meetingUrl]);
  const videoEmbed = f.videoUrl && !f.videoUrl.includes("blob.vercel-storage.com") ? embedFor(f.videoUrl) : null;
  const orgs = opts?.organizations ?? [];
  const lockedPast = initial && (initial.event.phase === "COMPLETED" || initial.event.phase === "CANCELLED" || initial.event.phase === "ARCHIVED");

  // The same checks the server runs, so people see what is wrong before saving. The server stays the authority.
  const live = useMemo(() => validateEvent({ ...payload(f), passcode: undefined }, "schedule"), [f]);
  const draftCheck = useMemo(() => validateEvent(payload(f), "draft"), [f]);
  const stepsWithProblems = useMemo(() => new Set(Object.keys(live.errors).map((k) => FIELD_STEP[k] ?? 0)), [live]);

  const recurrence: Recurrence | null = !existing && repeat.freq !== "NONE" ? { freq: repeat.freq, weekdays: repeat.freq === "WEEKLY" ? repeat.weekdays : undefined, count: repeat.ends === "count" ? Number(repeat.count) : undefined, until: repeat.ends === "until" ? repeat.until : undefined } : null;
  const series = useMemo(() => (recurrence ? expandRecurrence(f.startLocal, f.endLocal, recurrence) : null), [recurrence, f.startLocal, f.endLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewEvent: CardEvent = useMemo(() => {
    const zone = validZone(f.timeZone) ? f.timeZone : "Africa/Lagos";
    const s = zonedToUtc(f.startLocal, zone) ?? new Date("2030-01-01T09:00:00Z"), e = zonedToUtc(f.endLocal, zone) ?? new Date(s.getTime() + 36e5);
    return {
      id: eventId ?? "preview", title: f.title || "Your event title", summary: f.summary || null, eventType: f.eventType, startsAt: s.toISOString(), endsAt: e.toISOString(), timeZone: zone, delivery: f.delivery,
      venueName: f.venueName || null, city: f.city || null, flyerUrl: f.flyerUrl || null, phase: "UPCOMING", registrationMode: f.registrationMode, capacity: f.capacity ? Number(f.capacity) || null : null, confirmedCount: 0,
      organizer: scope === "organization" ? { kind: "ORGANIZATION", name: orgName ?? "Your organisation" } : f.organizationId ? { kind: "ORGANIZATION", name: orgs.find((o) => o.id === f.organizationId)?.name ?? "Organisation", promotedByAaicbi: true } : { kind: "AAICBI", name: "AAICBI" },
      category: categories.find((c) => c.id === f.categoryId) ?? null,
    };
  }, [f, categories, eventId, scope, orgName, orgs]);

  async function upload(kind: "flyer" | "image" | "video", file: File | undefined, apply: (url: string, file: File) => void) {
    if (!file) return;
    const rules = MEDIA_RULES[kind === "flyer" ? "FLYER" : kind === "image" ? "IMAGE" : "VIDEO"];
    if (!(rules.types as readonly string[]).includes(file.type)) { setProblem(`That is not an ${rules.label}.`); return; }
    if (file.size > rules.maxBytes) { setProblem(`That file is too big. It must be an ${rules.label}.`); return; }
    setUploading(kind); setProblem(null);
    try {
      const blob = await uploadPresigned(`${mediaPrefix(kind)}${file.name}`, file, { access: "public", handleUploadUrl: "/api/events/upload-token", contentType: file.type });
      apply(blob.url, file);
    } catch (e) { setProblem(e instanceof Error ? e.message : "Could not upload that file. Try again."); }
    setUploading(null);
  }

  async function submit(action: "save" | "schedule" | "submit") {
    setProblem(null);
    const check = action === "save" && !scheduled ? draftCheck : live;
    if (!check.ok) {
      setErrors(check.errors);
      const first = Math.min(...Object.keys(check.errors).map((k) => FIELD_STEP[k] ?? 0));
      setStep(first); top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setProblem("Some details need attention. The steps marked with a warning sign show what to fix.");
      return;
    }
    if (recurrence && action === "submit") { setProblem("Save the repeating events first, then ask for public promotion on each event you want promoted."); return; }
    if (recurrence && series && !series.ok) { setErrors({ recurrence: series.error }); setStep(1); setProblem(series.error); return; }
    setBusy(action);
    const res = await fetch(existing ? `${apiBase}/${eventId}` : apiBase, {
      method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload(f), organizationId: scope === "platform" ? f.organizationId || null : undefined, recurrence }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      if (j.fields) { setErrors(j.fields); const first = Math.min(...Object.keys(j.fields).map((k: string) => FIELD_STEP[k] ?? 0)); setStep(first); }
      setProblem(j.error ?? "That did not work.");
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const extra = [...(j.conflicts?.length ? [`Overlaps with: ${j.conflicts.join(", ")}.`] : []), ...(j.warnings ?? [])].join(" ");
    showToast(j.created > 1 ? `${j.created} events ${action === "schedule" ? "scheduled" : "saved as drafts"}.` : action === "submit" ? "Saved and sent to AAICBI for review." : action === "schedule" ? "Event scheduled." : "Saved.");
    if (extra) showToast(extra);
    router.push(`${uiBase}/${j.event.id}`);
    router.refresh();
  }

  const err = (k: string) => errors[k] ?? null;
  const toggleTarget = (kind: TargetInput["kind"], refId: string) => set("targets", f.targets.some((t) => t.kind === kind && t.refId === refId) ? f.targets.filter((t) => !(t.kind === kind && t.refId === refId)) : [...f.targets, { kind, refId }]);
  const has = (kind: TargetInput["kind"], refId: string) => f.targets.some((t) => t.kind === kind && t.refId === refId);
  const needsTargets = f.audience === "SELECTED_TRAINEES" || f.audience === "INVITED";
  const filteredTrainees = (opts?.trainees ?? []).filter((t) => !traineeQuery || (t.name ?? "").toLowerCase().includes(traineeQuery.toLowerCase())).slice(0, 60);

  const mediaPick = "block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-mint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-ink";

  return (
    <div ref={top} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="event-form">
      <div className="min-w-0 space-y-4">
        <nav aria-label="Steps" className="flex gap-1 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {STEPS.map((label, i) => (
            <button key={label} type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${step === i ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray text-gray-700 hover:bg-brand-mint/50"}`}>
              <span className="text-xs">{i + 1}</span> {label}
              {stepsWithProblems.has(i) && (Object.keys(errors).length > 0 || i < step) && <CircleAlert className="h-4 w-4 text-brand-rose" aria-label="needs attention" />}
            </button>
          ))}
        </nav>
        {problem && <p role="alert" className="rounded-lg border border-brand-rose bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">{problem}</p>}
        {lockedPast && <p className="rounded-lg border border-brand-gray bg-brand-mint/40 px-3 py-2 text-sm text-brand-ink">This event is {initial?.event.phase.toLowerCase()} and can no longer be changed.</p>}

        <Card>
          <fieldset disabled={!!lockedPast} className="space-y-4">
            {step === 0 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Basic information</legend>
                {scope === "platform" && !existing && (
                  <Select label="Organiser" value={f.organizationId} onChange={(e) => set("organizationId", e.target.value)} error={err("organizationId")}
                    hint="Choose AAICBI for an event AAICBI organises. Choose an organisation to promote its event on its behalf: the organisation stays the named organiser.">
                    <option value="">AAICBI (platform event)</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                )}
                {scope === "organization" && <p className={hint}>Organiser: <b>{orgName}</b></p>}
                <Input label="Event title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={LIMITS.title} required error={err("title")} />
                <Textarea label="Short summary" value={f.summary} onChange={(e) => set("summary", e.target.value)} rows={2} maxLength={LIMITS.summary} error={err("summary")} hint={`Shown on cards. ${f.summary.length}/${LIMITS.summary}`} />
                <Textarea label="Full description" value={f.description} onChange={(e) => set("description", e.target.value)} rows={6} maxLength={LIMITS.description} error={err("description")} hint="What people will do, who it is for, what to bring. Plain text; line breaks are kept." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Kind of activity" value={f.eventType} onChange={(e) => set("eventType", e.target.value)}>
                    {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </Select>
                  <Select label="Category" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={err("categoryId")}>
                    <option value="">No category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Date and time</legend>
                <Select label="Time zone" value={f.timeZone} onChange={(e) => set("timeZone", e.target.value)} error={err("timeZone")} hint="Times are saved exactly and always shown with this zone, wherever the viewer is.">
                  {[...new Set([f.timeZone, ...COMMON_ZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
                </Select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Starts" type="datetime-local" value={f.startLocal} onChange={(e) => set("startLocal", e.target.value)} required error={err("startLocal")} />
                  <Input label="Ends" type="datetime-local" value={f.endLocal} onChange={(e) => set("endLocal", e.target.value)} required error={err("endLocal")} />
                </div>
                {live.warnings.map((w) => <p key={w} className="rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText">{w}</p>)}
                <Input label="Registration deadline (optional)" type="datetime-local" value={f.registrationDeadlineLocal} onChange={(e) => set("registrationDeadlineLocal", e.target.value)} error={err("registrationDeadlineLocal")} />
                {!existing && (
                  <div className="space-y-3 rounded-xl border border-brand-gray p-4" data-testid="repeat-box">
                    <Select label="Repeat" value={repeat.freq} onChange={(e) => setRepeat({ ...repeat, freq: e.target.value as "NONE" | RepeatFreq })} hint="Makes separate events, each at the same time of day. You can edit or cancel each one on its own.">
                      <option value="NONE">Does not repeat</option>
                      {(Object.keys(FREQ_LABEL) as RepeatFreq[]).map((k) => <option key={k} value={k}>{FREQ_LABEL[k]}</option>)}
                    </Select>
                    {repeat.freq === "WEEKLY" && (
                      <fieldset><legend className="text-sm font-semibold text-brand-ink">On these days (leave empty for the first event&apos;s weekday)</legend>
                        <div className="mt-1 flex flex-wrap gap-1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <label key={d} className={`flex min-h-[40px] cursor-pointer items-center rounded-full border px-3 text-sm font-semibold ${repeat.weekdays.includes(i) ? "border-brand-teal bg-brand-mint" : "border-brand-gray"}`}><input type="checkbox" className="sr-only" checked={repeat.weekdays.includes(i)} onChange={() => setRepeat({ ...repeat, weekdays: repeat.weekdays.includes(i) ? repeat.weekdays.filter((x) => x !== i) : [...repeat.weekdays, i] })} />{d}</label>)}</div>
                      </fieldset>
                    )}
                    {repeat.freq !== "NONE" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select label="Stops" value={repeat.ends} onChange={(e) => setRepeat({ ...repeat, ends: e.target.value as "count" | "until" })}><option value="count">After a number of events</option><option value="until">On a date</option></Select>
                        {repeat.ends === "count" ? <Input label="Number of events (2 to 52)" type="number" min={2} max={52} value={repeat.count} onChange={(e) => setRepeat({ ...repeat, count: e.target.value })} /> : <Input label="Last day" type="date" value={repeat.until} onChange={(e) => setRepeat({ ...repeat, until: e.target.value })} />}
                      </div>
                    )}
                    {series && (series.ok ? <p className="rounded-lg bg-brand-mint/40 px-3 py-2 text-sm text-brand-ink" role="status">This makes <b>{series.occurrences.length} events</b>, from {formatDay(zonedToUtc(series.occurrences[0].startLocal, validZone(f.timeZone) ? f.timeZone : "Africa/Lagos") ?? new Date(), "UTC")} to {formatDay(zonedToUtc(series.occurrences[series.occurrences.length - 1].startLocal, validZone(f.timeZone) ? f.timeZone : "Africa/Lagos") ?? new Date(), "UTC")}.{scope === "organization" && f.audience === "PUBLIC" ? " Ask for public promotion on each event afterwards." : ""}</p> : <p className="rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText" role="status">{series.error}</p>)}
                    {err("recurrence") && <p role="alert" className="text-sm text-brand-rose">{err("recurrence")}</p>}
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">How people attend</legend>
                <div role="radiogroup" aria-label="Delivery method" className="grid gap-2 sm:grid-cols-3">
                  {DELIVERIES.map((d) => (
                    <label key={d} className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${f.delivery === d ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray text-gray-700"}`}>
                      <input type="radio" name="delivery" value={d} checked={f.delivery === d} onChange={() => set("delivery", d)} className="sr-only" /> {DELIVERY_LABEL[d]}
                    </label>
                  ))}
                </div>
                {physical && (
                  <div className="space-y-4 rounded-xl border border-brand-gray p-4">
                    <p className="font-semibold text-brand-ink">Physical venue</p>
                    <Input label="Venue name" value={f.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={LIMITS.venue} error={err("venueName")} />
                    <Input label="Street address" value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={LIMITS.address} error={err("address")} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="City" value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={LIMITS.city} />
                      <Input label="State" value={f.state} onChange={(e) => set("state", e.target.value)} maxLength={LIMITS.city} />
                    </div>
                    <Textarea label="Directions (optional)" value={f.directions} onChange={(e) => set("directions", e.target.value)} rows={3} maxLength={LIMITS.directions} />
                    <Input label="Map link (optional)" type="url" value={f.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://maps.google.com/..." error={err("mapUrl")} />
                    <Textarea label="Attendance instructions (optional)" value={f.attendanceNotes} onChange={(e) => set("attendanceNotes", e.target.value)} rows={2} maxLength={LIMITS.notes} hint="For example: bring an ID, arrive 20 minutes early." />
                  </div>
                )}
                {online && (
                  <div className="space-y-4 rounded-xl border border-brand-gray p-4">
                    <p className="font-semibold text-brand-ink">Online session</p>
                    <p className={hint}>AAICBI does not host the call. Paste a Google Meet, Zoom, Microsoft Teams or other video link. The link and passcode are shown only to people allowed to join, shortly before the start. They are never shown on public pages.</p>
                    <Input label="Meeting link (https)" type="url" value={f.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/..." error={err("meetingUrl")} hint={provider ? `Recognised: ${provider}` : undefined} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="Meeting ID (if needed)" value={f.meetingId} onChange={(e) => set("meetingId", e.target.value)} maxLength={LIMITS.meetingId} autoComplete="off" />
                      <Input label="Passcode (if needed)" type="text" value={f.passcode} onChange={(e) => { set("passcode", e.target.value); set("clearPasscode", false); }} maxLength={LIMITS.passcode} autoComplete="off"
                        hint={hasPasscode && !f.clearPasscode ? "A passcode is saved and is not shown. Type a new one to replace it." : undefined} />
                    </div>
                    {hasPasscode && <Checkbox label="Remove the saved passcode" checked={f.clearPasscode} onChange={(e) => { set("clearPasscode", e.target.checked); if (e.target.checked) set("passcode", ""); }} />}
                    <Textarea label="Joining instructions (optional)" value={f.joinInstructions} onChange={(e) => set("joinInstructions", e.target.value)} rows={3} maxLength={LIMITS.instructions} hint="For example: use your real name; wait in the lobby until admitted." />
                    <Input label="Open the join button this many minutes before the start (optional)" type="number" min={0} max={1440} value={f.joinOpensMinutes} onChange={(e) => set("joinOpensMinutes", e.target.value)} error={err("joinOpensMinutes")} hint="Leave empty to use the platform default." />
                  </div>
                )}
                {f.delivery === "HYBRID" && <Checkbox label="Online and in-person attendance need separate registration or instructions" checked={f.hybridSeparateRegistration} onChange={(e) => set("hybridSeparateRegistration", e.target.checked)} />}
              </>
            )}

            {step === 3 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Flyer and promotional media</legend>
                <p className={hint}>The flyer is the picture on event cards. Without one, a designed AAICBI cover is used.</p>
                {canUpload && uploadsOn === false && <p role="status" className="rounded-lg border border-brand-gold bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText">File uploads are not set up on this server yet, so flyers and videos cannot be uploaded. You can still add a YouTube or Vimeo link below, and the event will use the AAICBI cover. Ask your administrator to connect file storage.</p>}
                {canUpload ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-brand-ink" htmlFor="flyer">Flyer or poster</label>
                      <input id="flyer" type="file" accept={MEDIA_RULES.FLYER.types.join(",")} className={mediaPick} disabled={uploading === "flyer" || uploadsOn === false} onChange={(e) => void upload("flyer", e.target.files?.[0], (url) => set("flyerUrl", url))} />
                      <p className={hint}>{MEDIA_RULES.FLYER.label}{uploading === "flyer" ? " · uploading…" : ""}</p>
                      {err("flyerUrl") && <p role="alert" className="text-xs text-brand-rose">{err("flyerUrl")}</p>}
                      {f.flyerUrl && <div className="mt-2 flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={f.flyerUrl} alt="Flyer preview" className="h-24 w-auto rounded-lg border border-brand-gray object-contain" /><Button type="button" size="sm" variant="secondary" onClick={() => set("flyerUrl", "")}>Remove flyer</Button></div>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-brand-ink" htmlFor="video">Promotional video</label>
                      <input id="video" type="file" accept={MEDIA_RULES.VIDEO.types.join(",")} className={mediaPick} disabled={uploading === "video" || uploadsOn === false} onChange={(e) => void upload("video", e.target.files?.[0], (url) => set("videoUrl", url))} />
                      <p className={hint}>{MEDIA_RULES.VIDEO.label}{uploading === "video" ? " · uploading…" : ""}</p>
                    </div>
                  </div>
                ) : <p className="rounded-lg bg-brand-mint/40 px-3 py-2 text-sm text-brand-ink">You do not have permission to upload files. You can still paste a video link below.</p>}
                <Input label="Or a video link (YouTube or Vimeo)" type="url" value={f.videoUrl.includes("blob.vercel-storage.com") ? "" : f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} error={err("videoUrl")} placeholder="https://youtu.be/..." hint={videoEmbed ? `Recognised: ${videoEmbed.provider}` : undefined} />
                {f.videoUrl.includes("blob.vercel-storage.com") && <p className={hint}>An uploaded video is attached. <button type="button" className="font-semibold text-brand-teal underline" onClick={() => set("videoUrl", "")}>Remove it</button></p>}
                {videoEmbed && <div className="aspect-video overflow-hidden rounded-xl border border-brand-gray"><iframe src={videoEmbed.embedUrl} title="Video preview" className="h-full w-full" loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /></div>}
                {f.videoUrl.includes("blob.vercel-storage.com") && <video src={f.videoUrl} controls preload="metadata" className="max-h-60 w-full rounded-xl border border-brand-gray" />}
                {canUpload && (
                  <div>
                    <label className="block text-sm font-semibold text-brand-ink" htmlFor="extra">More pictures (optional, up to 8)</label>
                    <input id="extra" type="file" accept={MEDIA_RULES.IMAGE.types.join(",")} className={mediaPick} disabled={uploading === "image" || f.media.length >= 8 || uploadsOn === false} onChange={(e) => void upload("image", e.target.files?.[0], (url, file) => set("media", [...f.media, { kind: "IMAGE", url, mimeType: file.type, sizeBytes: file.size, caption: null }]))} />
                    {err("media") && <p role="alert" className="text-xs text-brand-rose">{err("media")}</p>}
                    {f.media.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {f.media.map((m, i) => (
                          <li key={m.url} className="relative">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.url} alt="" className="h-20 w-28 rounded-lg border border-brand-gray object-cover" />
                            <button type="button" aria-label="Remove picture" onClick={() => set("media", f.media.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-rose text-xs font-bold text-white">×</button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Audience and visibility</legend>
                <div role="radiogroup" aria-label="Audience" className="space-y-2">
                  {AUDIENCES.map((a) => (
                    <label key={a} className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${f.audience === a ? "border-brand-teal bg-brand-mint" : "border-brand-gray"}`}>
                      <input type="radio" name="audience" value={a} checked={f.audience === a} onChange={() => set("audience", a)} className="mt-1" />
                      <span><b className="text-brand-ink">{AUDIENCE_LABEL[a]}</b>
                        <span className="block text-xs text-gray-600">{{
                          PUBLIC: scope === "organization" ? "Public events are reviewed by AAICBI before they appear on the public pages. Until then it stays an internal event for your own people." : "Visible on the feed and the public events page once published.",
                          ORG_MEMBERS: scope === "organization" ? "Everyone with access to your courses, and your team." : "Trainees of organisations, and organisation accounts.",
                          SELECTED_TRAINEES: "Only the cohorts, courses or trainees you choose.", ORG_STAFF: scope === "organization" ? "Your team only." : "Training organisation accounts only.",
                          INVITED: "Only the people you invite.", PRIVATE: "Not advertised. Visible only to your team and anyone you invite.",
                        }[a]}</span></span>
                    </label>
                  ))}
                </div>
                {err("audience") && <p role="alert" className="text-xs text-brand-rose">{err("audience")}</p>}
                {needsTargets && (
                  <div className="space-y-3 rounded-xl border border-brand-gray p-4">
                    <p className="font-semibold text-brand-ink">{f.audience === "INVITED" ? "Who to invite" : "Who it is for"}</p>
                    {err("targets") && <p role="alert" className="text-xs text-brand-rose">{err("targets")}</p>}
                    {!opts ? <p className={hint}>Loading…</p> : (
                      <>
                        {f.audience === "SELECTED_TRAINEES" && (
                          <>
                            <PickList title="Courses" items={(opts.courses ?? []).map((c) => ({ id: c.id, label: c.title ?? "" }))} has={(id) => has("COURSE", id)} toggle={(id) => toggleTarget("COURSE", id)} />
                            <PickList title="Cohorts" items={(opts.cohorts ?? []).map((c) => ({ id: c.id, label: c.name ?? "" }))} has={(id) => has("COHORT", id)} toggle={(id) => toggleTarget("COHORT", id)} />
                          </>
                        )}
                        <div>
                          <Input label="Find a trainee" value={traineeQuery} onChange={(e) => setTraineeQuery(e.target.value)} placeholder="Type a name" compact />
                          <PickList title="Trainees" items={filteredTrainees.map((t) => ({ id: t.id, label: t.name ?? "" }))} has={(id) => has("TRAINEE", id)} toggle={(id) => toggleTarget("TRAINEE", id)} />
                        </div>
                        {(opts.courses?.length ?? 0) + (opts.trainees?.length ?? 0) === 0 && <p className={hint}>{scope === "platform" ? "Choose an organisation on the first step to pick from its courses and trainees." : "You have no courses or enrolled trainees yet."}</p>}
                      </>
                    )}
                    <p className={hint}>{f.targets.length} selected</p>
                  </div>
                )}
              </>
            )}

            {step === 5 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Registration</legend>
                <Select label="How people take part" value={f.registrationMode} onChange={(e) => set("registrationMode", e.target.value as RegistrationMode)} error={err("registrationMode")}>
                  {REGISTRATION_MODES.map((m) => <option key={m} value={m}>{REGISTRATION_MODE_LABEL[m]}</option>)}
                </Select>
                {(f.registrationMode === "REGISTRATION" || f.registrationMode === "APPROVAL") && (
                  <Input label="Maximum attendance (optional)" type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} error={err("capacity")} hint="When it is full, people cannot register." />
                )}
                <Textarea label="Registration requirements or notes (optional)" value={f.registrationNotes} onChange={(e) => set("registrationNotes", e.target.value)} rows={2} maxLength={LIMITS.notes} />
                <Input label="Register somewhere else instead (optional link)" type="url" value={f.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} error={err("registrationUrl")} hint="Shown as a Register button that opens in a new tab. Use this only if you take registrations outside AAICBI." />
              </>
            )}

            {step === 6 && (
              <>
                <legend className="font-display text-lg font-semibold text-brand-ink">Preview and finish</legend>
                <p className={hint}>This is how the event appears on the feed and in the events directory.</p>
                <div className="max-w-sm"><EventCard event={previewEvent} href="#" /></div>
                {!live.ok && (
                  <div role="alert" className="rounded-lg border border-brand-gold bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText">
                    <p className="font-semibold">Before you can schedule:</p>
                    <ul className="list-disc pl-5">{Object.entries(live.errors).map(([k, v]) => <li key={k}><button type="button" className="underline" onClick={() => setStep(FIELD_STEP[k] ?? 0)}>{v}</button></li>)}</ul>
                  </div>
                )}
                {scope === "organization" && f.audience === "PUBLIC" && <p className="rounded-lg bg-brand-mint/50 px-3 py-2 text-sm text-brand-ink">You chose the Public audience. Scheduling keeps it internal. To ask AAICBI to advertise it, use <b>Submit for public promotion</b>. It is not published until AAICBI approves it.</p>}
                {scope === "platform" && f.audience === "PUBLIC" && <p className="rounded-lg bg-brand-mint/50 px-3 py-2 text-sm text-brand-ink">After scheduling, press <b>Publish</b> on the event page to put it on the public pages{canPublish ? "" : " (needs the publish permission)"}.</p>}
              </>
            )}
          </fieldset>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-brand-gray bg-brand-surface/95 px-1 py-3 backdrop-blur">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)} iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>Back</Button>
            {step < STEPS.length - 1 && <Button type="button" variant="secondary" onClick={() => setStep(step + 1)} iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Next</Button>}
          </div>
          {!lockedPast && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" loading={busy === "save"} onClick={() => void submit("save")}>{scheduled ? "Save changes" : "Save draft"}</Button>
              {!scheduled && <Button type="button" loading={busy === "schedule"} onClick={() => void submit("schedule")} iconLeft={<Check className="h-4 w-4" aria-hidden="true" />}>Schedule event</Button>}
              {scope === "organization" && canSubmitPromotion && f.audience === "PUBLIC" && <Button type="button" loading={busy === "submit"} onClick={() => void submit("submit")}>Submit for public promotion</Button>}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden lg:block" aria-label="Live preview">
        <div className="sticky top-4 space-y-2">
          <p className="text-sm font-semibold text-brand-ink">Live preview</p>
          <EventCard event={previewEvent} href="#" />
          <Badge variant={live.ok ? "success" : "warning"}>{live.ok ? "Ready to schedule" : `${Object.keys(live.errors).length} to fix before scheduling`}</Badge>
        </div>
      </aside>
    </div>
  );
}

function PickList({ title, items, has, toggle }: { title: string; items: { id: string; label: string }[]; has: (id: string) => boolean; toggle: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-ink">{title}</legend>
      <ul className="mt-1 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-brand-gray p-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id}><label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-brand-mint/50"><input type="checkbox" checked={has(i.id)} onChange={() => toggle(i.id)} /> <span className="[overflow-wrap:anywhere]">{i.label}</span></label></li>
        ))}
      </ul>
    </fieldset>
  );
}
