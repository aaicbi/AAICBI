"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Recipient { id: string; name: string; email: string; status: string; awardedAt: string; revokedAt: string | null }
interface Scholarship { seats: number; minPlays: number; held: number; finishedPlays: number; left: number; open: boolean; reason: string | null; blockers: string[]; recipients: Recipient[] }
interface CourseCard { id: string; title: string; enabled: boolean; live: boolean; link: string | null; readinessIssues: string[]; blockers: string[]; scholarship: Scholarship }
interface OrgCard { id: string; name: string; enabled: boolean; agreementAt: string | null; commissionPercent: number | null; scholarshipEnabled: boolean; courses: CourseCard[] }
interface Overview {
  switches: { platform: boolean; own: boolean; orgs: boolean; ownScholarships: boolean };
  ownCourses: CourseCard[];
  organizations: OrgCard[];
  log: { id: string; action: string; scopeType: string; detail: string | null; at: string; by: string }[];
}

const ACTION_LABEL: Record<string, string> = {
  SWITCH_ON: "switched on", SWITCH_OFF: "switched off", AGREEMENT_RECORDED: "recorded the agreement for", COMMISSION_SET: "set commission", SCHOLARSHIPS_ON: "turned scholarships on for", SCHOLARSHIPS_OFF: "turned scholarships off for", SEATS_SET: "set scholarship seats", SEAT_REVOKED: "took back a scholarship seat from",
  COURSE_ON: "opted in course", COURSE_OFF: "opted out course", TASTER_APPROVED: "approved the taster for", TASTER_PROPOSED: "proposed a taster for",
};

/** Super Admin: the growth funnel switches. Platform master, AAICBI courses, organization courses, then each organization and each course. */
export default function GrowthAdmin() {
  const { showToast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/growth");
    if (!res.ok) { setError("The growth settings could not be loaded."); return; }
    setData(await res.json());
    setError(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(key: string, body: Record<string, unknown>, done?: string) {
    setBusy(true);
    setProblem((p) => ({ ...p, [key]: "" }));
    const res = await fetch("/api/admin/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const issues: string[] = Array.isArray(json.issues) ? json.issues : [];
      setProblem((p) => ({ ...p, [key]: [json.error, ...issues].filter(Boolean).join(" ") }));
      return;
    }
    setData(json);
    if (done) showToast(done);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;
  const masterOn = data.switches.platform;

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">Switches</h2>
        <p className="mt-1 text-sm text-gray-600">A course runs its public link only when every layer allows it. Everything is off until you switch it on.</p>
        <div className="mt-3 divide-y divide-brand-gray/40">
          <Row title="Platform master switch" note="Emergency kill. Off means no public play link works anywhere." checked={data.switches.platform} disabled={busy} onChange={(v) => send("g", { action: "global", scope: "PLATFORM", enabled: v }, v ? "Growth funnel is on." : "Growth funnel is off.")} />
          <Row title="AAICBI's own courses" note="Separate from organization courses." checked={data.switches.own} disabled={busy} onChange={(v) => send("g", { action: "global", scope: "OWN", enabled: v })} />
          <Row title="Scholarship seats for AAICBI courses" note="Lets people who pass module 1 earn a free seat, up to the number you set on each course." checked={data.switches.ownScholarships} disabled={busy} onChange={(v) => send("g", { action: "ownScholarships", enabled: v })} />
          <Row title="Organization courses" note="Lets the per-organization switches below take effect." checked={data.switches.orgs} disabled={busy} onChange={(v) => send("g", { action: "global", scope: "ORGS", enabled: v })} />
        </div>
        {problem.g && <p className="mt-2 text-sm text-brand-rose" role="alert">{problem.g}</p>}
        {!masterOn && <p className="mt-3 rounded-lg bg-brand-goldLight p-3 text-sm text-brand-goldText">The master switch is off, so no link is live yet, whatever the switches below say.</p>}
      </Card>

      <section aria-labelledby="own-h">
        <h2 id="own-h" className="font-display text-lg font-semibold text-brand-ink">AAICBI courses</h2>
        {data.ownCourses.length === 0 ? <p className="mt-1 text-sm text-gray-600">No courses yet.</p> : <div className="mt-2 space-y-2">{data.ownCourses.map((c) => <CourseRow key={c.id} c={c} busy={busy} problem={problem[c.id]} onToggle={(v) => send(c.id, { action: "course", courseId: c.id, enabled: v })} onSend={(body, done) => send(c.id, body, done)} />)}</div>}
      </section>

      <section aria-labelledby="org-h">
        <h2 id="org-h" className="font-display text-lg font-semibold text-brand-ink">Organizations</h2>
        <div className="mt-2 space-y-3">
          {data.organizations.length === 0 && <p className="text-sm text-gray-600">No approved organizations yet.</p>}
          {data.organizations.map((o) => (
            <OrgPanel key={o.id} o={o} busy={busy} problem={problem[o.id]} onSend={(body, done) => send(o.id, { action: "org", organizationId: o.id, ...body }, done)} onCourse={(c, v) => send(c.id, { action: "course", courseId: c.id, enabled: v })} onCourseSend={(c, body, done) => send(c.id, body, done)} courseProblem={problem} />
          ))}
        </div>
      </section>

      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">Recent changes</h2>
        {data.log.length === 0 ? <p className="mt-1 text-sm text-gray-600">Nothing yet.</p> : (
          <ul className="mt-2 space-y-1 text-sm text-brand-ink">
            {data.log.map((l) => <li key={l.id}><span className="font-semibold">{l.by}</span> {ACTION_LABEL[l.action] ?? l.action.toLowerCase()} {l.detail ?? l.scopeType.toLowerCase()} <span className="text-gray-600">· {new Date(l.at).toLocaleString()}</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ title, note, checked, disabled, onChange }: { title: string; note: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="font-semibold text-brand-ink">{title}</p><p className="text-sm text-gray-600">{note}</p></div>
      <Toggle checked={checked} disabled={disabled} label={title} onChange={onChange} />
    </div>
  );
}

function CourseRow({ c, busy, problem, onToggle, onSend }: { c: CourseCard; busy: boolean; problem?: string; onToggle: (v: boolean) => void; onSend: (body: Record<string, unknown>, done?: string) => void }) {
  const notReady = c.readinessIssues.length > 0;
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-brand-ink">{c.title} {c.live ? <Badge variant="success">Live</Badge> : c.enabled ? <Badge variant="warning">On, blocked</Badge> : null}</p>
          {c.link && (
            <p className="mt-0.5 break-all text-sm text-gray-600">{c.link}{" "}
              <button type="button" className="font-semibold text-brand-teal underline" onClick={() => { void navigator.clipboard?.writeText(c.link ?? "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }}>{copied ? "Copied" : "Copy"}</button>
            </p>
          )}
        </div>
        <Toggle checked={c.enabled} disabled={busy || (notReady && !c.enabled)} label={`Opt in ${c.title}`} onChange={onToggle} />
      </div>
      {notReady && <ul className="mt-2 space-y-0.5 text-sm text-brand-rose">{c.readinessIssues.map((i) => <li key={i}>Not ready: {i}</li>)}</ul>}
      {!notReady && c.enabled && c.blockers.length > 0 && <ul className="mt-2 space-y-0.5 text-sm text-gray-600">{c.blockers.map((i) => <li key={i}>{i}</li>)}</ul>}
      {c.enabled && <SeatsPanel c={c} busy={busy} onSend={onSend} />}
      {problem && <p className="mt-2 text-sm text-brand-rose" role="alert">{problem}</p>}
    </div>
  );
}

/** Scholarship seats for one course: how many, when they open, and who holds them. */
function SeatsPanel({ c, busy, onSend }: { c: CourseCard; busy: boolean; onSend: (body: Record<string, unknown>, done?: string) => void }) {
  const sch = c.scholarship;
  const [seats, setSeats] = useState(String(sch.seats));
  const [minPlays, setMinPlays] = useState(String(sch.minPlays));
  const field = "mt-1 min-h-[44px] w-28 rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink";
  const active = sch.recipients.filter((r) => r.status === "AWARDED");
  return (
    <div className="mt-3 rounded-lg border border-brand-gray/60 p-3" data-testid={`seats-${c.id}`}>
      <p className="font-semibold text-brand-ink">Scholarship seats</p>
      <p className="text-sm text-gray-600">Free seats for people who pass module 1, first come first served. Nothing is given until the switches allow it and enough people have played.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="block text-sm"><span className="font-semibold text-brand-ink">Seats</span><input inputMode="numeric" className={field} value={seats} onChange={(e) => setSeats(e.target.value)} aria-label={`Scholarship seats for ${c.title}`} /></label>
        <label className="block text-sm"><span className="font-semibold text-brand-ink">Open after this many players finish</span><input inputMode="numeric" className={field} value={minPlays} onChange={(e) => setMinPlays(e.target.value)} aria-label={`Players needed for ${c.title}`} /></label>
        <button type="button" disabled={busy} className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60" onClick={() => onSend({ action: "seats", courseId: c.id, seats: seats.trim(), minPlays: minPlays.trim() }, "Seats saved.")}>Save</button>
      </div>
      <p className="mt-2 text-sm text-brand-ink">{sch.held} of {sch.seats} seat{sch.seats === 1 ? "" : "s"} given · {sch.finishedPlays} player{sch.finishedPlays === 1 ? "" : "s"} finished the taster.</p>
      <p className="text-sm text-gray-600">{sch.open ? `Open now, ${sch.left} left.` : sch.reason ?? ""}</p>
      {active.length > 0 && (
        <ul className="mt-2 divide-y divide-brand-gray/40 text-sm">
          {active.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 break-words text-brand-ink">{r.name} <span className="text-gray-600">· {new Date(r.awardedAt).toLocaleDateString()}</span></span>
              <button type="button" disabled={busy} className="min-h-[44px] shrink-0 rounded-full border border-brand-rose px-4 text-sm font-semibold text-brand-rose hover:bg-brand-roseLight disabled:opacity-60" onClick={() => { if (window.confirm(`Take the seat back from ${r.name}? They keep module 1 and will need to pay for the rest.`)) onSend({ action: "revokeSeat", scholarshipId: r.id }, "Seat taken back."); }}>Take back</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrgPanel({ o, busy, problem, onSend, onCourse, onCourseSend, courseProblem }: { o: OrgCard; busy: boolean; problem?: string; onSend: (body: Record<string, unknown>, done?: string) => void; onCourse: (c: CourseCard, v: boolean) => void; onCourseSend: (c: CourseCard, body: Record<string, unknown>, done?: string) => void; courseProblem: Record<string, string> }) {
  const [agree, setAgree] = useState(false);
  const [pct, setPct] = useState(o.commissionPercent == null ? "" : String(o.commissionPercent));
  const agreed = !!o.agreementAt;
  return (
    <div className="rounded-2xl border border-brand-gray/60 bg-brand-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-brand-ink">{o.name} {o.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}</h3>
          <p className="text-sm text-gray-600">{o.courses.length} course{o.courses.length === 1 ? "" : "s"}</p>
        </div>
        <Toggle checked={o.enabled} disabled={busy || (!o.enabled && !agreed && !agree)} label={`Switch on for ${o.name}`} onChange={(v) => onSend({ enabled: v, agree: v ? (agreed || agree) : undefined }, v ? `${o.name} is on.` : `${o.name} is off.`)} />
      </div>
      {agreed ? (
        <p className="mt-2 text-sm text-brand-ink">Agreement recorded on {new Date(o.agreementAt as string).toLocaleDateString()}.</p>
      ) : (
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-brand-goldLight p-3 text-sm text-brand-goldText">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{o.name} agreed to give module 1 free and to this campaign. This is logged with your name and the time.</span>
        </label>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-brand-ink">Commission owed to AAICBI (%)</span>
          <span className="mt-1 flex gap-2">
            <input inputMode="decimal" className="min-h-[44px] w-24 rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" value={pct} onChange={(e) => setPct(e.target.value)} aria-label={`Commission percent for ${o.name}`} />
            <button type="button" disabled={busy} className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60" onClick={() => onSend({ commissionPercent: pct.trim() === "" ? null : pct.trim() }, "Commission saved.")}>Save</button>
          </span>
        </label>
        <div className="flex items-center justify-between gap-3 text-sm">
          <div><p className="font-semibold text-brand-ink">Scholarship seats</p><p className="text-gray-600">Off until the organization agrees.</p></div>
          <Toggle checked={o.scholarshipEnabled} disabled={busy} label={`Scholarship seats for ${o.name}`} onChange={(v) => onSend({ scholarshipEnabled: v })} />
        </div>
      </div>
      {problem && <p className="mt-2 text-sm text-brand-rose" role="alert">{problem}</p>}
      <div className="mt-3 space-y-2">
        {o.courses.map((c) => <CourseRow key={c.id} c={c} busy={busy} problem={courseProblem[c.id]} onToggle={(v) => onCourse(c, v)} onSend={(body, done) => onCourseSend(c, body, done)} />)}
      </div>
    </div>
  );
}
