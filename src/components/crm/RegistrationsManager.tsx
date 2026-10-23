"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SOURCE_LABEL, STAGES, STAGE_LABEL } from "@/lib/crm/registrationCore";

interface Row { id: string; reference: string; stage: string; source: string; sourceTag: string | null; createdAt: string; followUpAt: string | null; course: { id: string; title: string }; name: string; email: string; phone: string | null; emailOk: boolean; whatsappOk: boolean; newsletter: boolean; optedOut: boolean; agreementVersion: number; signedAt: string }
interface List { total: number; page: number; pageSize: number; courses: { id: string; title: string }[]; summary: { new7: number; needFollowUp: number }; rows: Row[] }
interface Detail {
  id: string; reference: string; stage: string; source: string; sourceTag: string | null; createdAt: string; followUpAt: string | null; course: { id: string; title: string }; motivation: string | null; signedName: string; signedAt: string; agreementVersion: number;
  contact: { id: string; name: string; email: string; phone: string | null; country: string | null; state: string | null; optedOut: boolean; relationships: string[]; isTrainee: boolean };
  emailOk: boolean; whatsappOk: boolean; newsletter: boolean;
  activities: { id: string; kind: string; summary: string; createdAt: string }[]; tasks: { id: string; title: string; dueAt: string | null; doneAt: string | null }[];
  consents: { id: string; kind: string; granted: boolean; channels: string[]; noticeText: string; noticeVersion: number; createdAt: string }[]; otherRegistrations: { id: string; reference: string; course: string }[];
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const whenTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const isoDay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** The CRM registrations list with a detail panel: who registered, what they agreed to, a timeline, a follow-up date and notes. */
export default function RegistrationsManager({ canManage, canExport }: { canManage: boolean; canExport: boolean }) {
  const [list, setList] = useState<List | null>(null);
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [due, setDue] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (courseId) p.set("courseId", courseId);
    if (stage) p.set("stage", stage);
    if (source) p.set("source", source);
    if (due) p.set("needsFollowUp", "1");
    return p;
  }, [q, courseId, stage, source, due]);

  const load = useCallback(async () => {
    const p = qs(); p.set("page", String(page));
    const res = await fetch(`/api/admin/crm/registrations?${p}`);
    if (res.ok) setList(await res.json()); else setErr("We could not load registrations.");
  }, [qs, page]);
  useEffect(() => { const t = setTimeout(() => void load(), 200); return () => clearTimeout(t); }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/crm/registrations/${id}`);
    if (res.ok) setDetail(await res.json()); else setDetail(null);
  }, []);
  useEffect(() => { if (openId) void loadDetail(openId); else setDetail(null); }, [openId, loadDetail]);
  useEffect(() => { const r = new URLSearchParams(window.location.search).get("r"); if (r) setOpenId(r); }, []);

  async function patch(body: Record<string, unknown>) {
    if (!openId) return;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/crm/registrations/${openId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "That didn't work."); return; }
    setNote("");
    await Promise.all([loadDetail(openId), load()]);
  }
  async function finishTask(id: string) {
    setBusy(true);
    await fetch(`/api/admin/crm/tasks/${id}`, { method: "POST" });
    setBusy(false);
    if (openId) await loadDetail(openId);
  }

  const reset = () => setPage(1);
  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  return (
    <div className="flex flex-col gap-4">
      {list && (
        <div className="flex flex-wrap gap-3" data-testid="crm-summary">
          <Card className="min-w-[140px] flex-1"><p className="text-xs font-bold uppercase tracking-wider text-gray-600">Registrations</p><p className="font-display text-3xl font-bold text-brand-ink">{list.total}</p></Card>
          <Card className="min-w-[140px] flex-1"><p className="text-xs font-bold uppercase tracking-wider text-gray-600">New in 7 days</p><p className="font-display text-3xl font-bold text-brand-ink">{list.summary.new7}</p></Card>
          <Card className="min-w-[140px] flex-1"><p className="text-xs font-bold uppercase tracking-wider text-gray-600">Need follow-up</p><p className="font-display text-3xl font-bold text-brand-ink">{list.summary.needFollowUp}</p></Card>
        </div>
      )}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Search" placeholder="Name, email or reference" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} wrapperClassName="lg:col-span-2" />
          <Select label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); reset(); }}>
            <option value="">All courses</option>
            {list?.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
          <Select label="Stage" value={stage} onChange={(e) => { setStage(e.target.value); reset(); }}>
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </Select>
          <Select label="Source" value={source} onChange={(e) => { setSource(e.target.value); reset(); }}>
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-ink"><input type="checkbox" className="h-5 w-5 accent-[var(--brand-teal,#016B61)]" checked={due} onChange={(e) => { setDue(e.target.checked); reset(); }} /> Needs follow-up</label>
          {canExport && <a className="inline-flex min-h-[44px] items-center rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" href={`/api/admin/crm/registrations?${qs()}&format=csv`} data-testid="crm-export">Download spreadsheet</a>}
        </div>
      </Card>
      {err && <p role="alert" className="text-sm text-brand-rose">{err}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="min-w-0 !p-0">
          {!list ? <p className="p-4 text-sm text-gray-600">Loading…</p> : list.rows.length === 0 ? <p className="p-4 text-sm text-brand-ink" data-testid="crm-empty">No registrations match. When someone registers through a course page or the taster game, they appear here.</p> : (
            <ul className="divide-y divide-brand-gray/60" data-testid="crm-rows">
              {list.rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpenId(r.id)} aria-current={openId === r.id} className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-brand-mint ${openId === r.id ? "bg-brand-mint" : ""}`}>
                    <span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-brand-ink">{r.name}</strong><Badge variant={r.stage === "REGISTERED" ? "gold" : r.stage === "WITHDRAWN" ? "neutral" : "success"}>{STAGE_LABEL[r.stage as keyof typeof STAGE_LABEL] ?? r.stage}</Badge></span>
                    <span className="text-sm text-brand-ink">{r.course.title}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-gray-600"><span>{SOURCE_LABEL[r.source as keyof typeof SOURCE_LABEL] ?? r.source}{r.sourceTag ? ` · ${r.sourceTag}` : ""}</span><span>{when(r.createdAt)}</span><span>{r.optedOut ? "Stopped messages" : `${r.emailOk ? "Email OK" : "No email"} · ${r.whatsappOk ? "WhatsApp OK" : "No WhatsApp"}`}</span>{r.followUpAt && <span>Follow up {when(r.followUpAt)}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list && pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-brand-gray/60 px-4 py-2 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-[44px] rounded-full border border-brand-gray px-4 font-semibold text-brand-ink disabled:opacity-50">Previous</button>
              <span className="text-brand-ink">Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="min-h-[44px] rounded-full border border-brand-gray px-4 font-semibold text-brand-ink disabled:opacity-50">Next</button>
            </div>
          )}
        </Card>

        <Card className="min-w-0" data-testid="crm-detail">
          {!detail ? <p className="text-sm text-gray-600">Choose a registration to see the person, what they agreed to and the timeline.</p> : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-brand-ink">{detail.contact.name}</h2>
                <p className="break-all text-sm text-brand-ink">{detail.contact.email}{detail.contact.phone ? ` · ${detail.contact.phone}` : ""}</p>
                <p className="text-xs text-gray-600">{[detail.contact.state, detail.contact.country].filter(Boolean).join(", ")}{detail.contact.isTrainee ? " · Already a trainee" : ""}</p>
                <p className="mt-1 text-sm font-semibold text-brand-ink">{detail.course.title} · {detail.reference}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={detail.emailOk ? "success" : "neutral"}>{detail.emailOk ? "Email OK" : "No email"}</Badge>
                <Badge variant={detail.whatsappOk ? "success" : "neutral"}>{detail.whatsappOk ? "WhatsApp OK" : "No WhatsApp"}</Badge>
                <Badge variant="neutral">Newsletter: {detail.newsletter ? "yes" : "no"}</Badge>
                {detail.contact.optedOut && <Badge variant="danger">Stopped all messages</Badge>}
              </div>
              <div className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3 text-sm text-brand-ink">
                <p><strong>Agreement</strong> version {detail.agreementVersion}, signed as &ldquo;{detail.signedName}&rdquo; on {whenTime(detail.signedAt)}.</p>
                {detail.motivation && <p className="mt-1"><strong>Why they joined:</strong> {detail.motivation}</p>}
              </div>
              {canManage && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Stage" value={detail.stage} disabled={busy} onChange={(e) => void patch({ stage: e.target.value })}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </Select>
                  <Input label="Follow up on" type="date" disabled={busy} value={isoDay(detail.followUpAt)} onChange={(e) => void patch({ followUpAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null })} />
                </div>
              )}
              {detail.tasks.length > 0 && (
                <div><h3 className="text-sm font-bold text-brand-ink">Tasks</h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {detail.tasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm text-brand-ink"><span className={t.doneAt ? "line-through opacity-60" : ""}>{t.title}{t.dueAt ? ` · due ${when(t.dueAt)}` : ""}</span>{!t.doneAt && canManage && <button type="button" disabled={busy} onClick={() => finishTask(t.id)} className="min-h-[44px] shrink-0 rounded-full border border-brand-gray px-3 text-xs font-semibold hover:bg-brand-mint">Done</button>}</li>
                    ))}
                  </ul>
                </div>
              )}
              {canManage && (
                <div className="flex flex-col gap-2">
                  <Textarea label="Add a note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                  <button type="button" disabled={busy || !note.trim()} onClick={() => void patch({ note })} className="min-h-[44px] self-start rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-50">Save note</button>
                </div>
              )}
              <div><h3 className="text-sm font-bold text-brand-ink">Timeline</h3>
                <ul className="mt-1 flex flex-col gap-2" data-testid="crm-timeline">
                  {detail.activities.map((a) => <li key={a.id} className="text-sm text-brand-ink"><span>{a.summary}</span><span className="block text-xs text-gray-600">{whenTime(a.createdAt)}</span></li>)}
                </ul>
              </div>
              {detail.otherRegistrations.length > 0 && <p className="text-sm text-brand-ink"><strong>Also registered for:</strong> {detail.otherRegistrations.map((o) => o.course).join(", ")}</p>}
              {err && <p role="alert" className="text-sm text-brand-rose">{err}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
