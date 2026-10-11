"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import AvatarUpload from "@/components/AvatarUpload";
import HandleChangeCard from "@/components/profile/HandleChangeCard";
import { INDUSTRIES, LIMITS, SEEKING, SEEKING_LABEL, STAGES, STAGE_LABEL } from "@/lib/startups/startupCore";

interface Startup { id: string; name: string; tagline: string | null; problem: string | null; solution: string | null; description: string | null; industry: string | null; stage: string; location: string | null; website: string | null; logoUrl: string | null; traction: string | null; fundingNeed: string | null; seeking: string[]; status: string; verified: boolean; reviewNote: string | null }
interface Me { role: string; canEdit: boolean; canPublish: boolean; canManageTeam: boolean; canSubmit: boolean }
interface Member { id: string; traineeId: string; name: string; handle: string | null; role: string; canEdit: boolean; canPublish: boolean; title: string | null; showOnProfile: boolean; status: string }

const STATUS: Record<string, ["neutral" | "warning" | "success" | "danger", string]> = { DRAFT: ["neutral", "Draft: only your team can see it"], PENDING: ["warning", "With a reviewer"], APPROVED: ["success", "Public"], REJECTED: ["danger", "Not approved"], SUSPENDED: ["danger", "Suspended"] };

/** Manage one startup: profile, logo, team and permissions, and sending it for review. */
export default function ManageStartupPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [s, setS] = useState<Startup | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Startup | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [invite, setInvite] = useState({ handle: "", title: "", canEdit: false, canPublish: false });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const r = await fetch(`/api/startups/${id}`);
    if (!r.ok) return setFailed(true);
    const d = await r.json();
    setS(d.startup); setForm(d.startup); setMe(d.me); setHandle(d.handle); setFailed(false);
    const t = await fetch(`/api/startups/${id}/team`);
    if (t.ok) setTeam((await t.json()).team);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof Startup, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setFormError(null);
    const res = await fetch(`/api/startups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, tagline: form.tagline ?? "", problem: form.problem ?? "", solution: form.solution ?? "", description: form.description ?? "", industry: form.industry, stage: form.stage, location: form.location ?? "", website: form.website ?? "", traction: form.traction ?? "", fundingNeed: form.fundingNeed ?? "", seeking: form.seeking }) });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setFormError(d.error ?? "Could not save.");
    showToast("Saved.", "success");
    load();
  }

  async function submit() {
    setBusy("submit");
    const res = await fetch(`/api/startups/${id}/submit`, { method: "POST" });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "Could not send for review.", "error");
    showToast("Sent for review. You will be told when it is decided.", "success");
    load();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite"); setInviteError(null);
    const res = await fetch(`/api/startups/${id}/team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: invite.handle, title: invite.title || null, canEdit: invite.canEdit, canPublish: invite.canPublish }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setInviteError(d.error ?? "Could not invite.");
    showToast("Invitation sent. They join only if they accept.", "success");
    setInvite({ handle: "", title: "", canEdit: false, canPublish: false });
    load();
  }

  async function patch(m: Member, body: Record<string, unknown>) {
    const res = await fetch(`/api/startups/${id}/team/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); return showToast(d.error ?? "That did not work.", "error"); }
    load();
  }

  async function remove(m: Member) {
    const res = await fetch(`/api/startups/${id}/team/${m.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    load();
  }

  if (failed) return <main className="mx-auto max-w-3xl px-4 py-8"><ErrorState message="Could not open this startup. You may not be on its team." onRetry={load} /><p className="mt-4 text-sm"><Link href="/trainee/startups" className="font-semibold text-brand-teal hover:underline">Back to my startups</Link></p></main>;
  if (!s || !form || !me) return <main className="mx-auto max-w-3xl px-4 py-8"><SkeletonList rows={3} /></main>;
  const ro = !me.canEdit;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm"><Link href="/trainee/startups" className="font-semibold text-brand-teal hover:underline">All my startups</Link></p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">{s.name}</h1>
        <Badge variant={STATUS[s.status]?.[0] ?? "neutral"}>{STATUS[s.status]?.[1] ?? s.status}</Badge>
        {s.verified && <Badge variant="success">Verified</Badge>}
      </div>
      {handle && <p className="mt-1 text-sm text-gray-700">Public page: <Link href={`/@${handle}`} className="font-semibold text-brand-teal hover:underline">/@{handle}</Link>{s.status !== "APPROVED" && " (only your team and reviewers can open it until it is approved)"}</p>}

      <Card className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review</h2>
        {s.status === "REJECTED" && s.reviewNote && <p className="mt-2 rounded-lg bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">The reviewer said: {s.reviewNote}</p>}
        {s.status === "SUSPENDED" && s.reviewNote && <p className="mt-2 rounded-lg bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">Suspended: {s.reviewNote}</p>}
        {(s.status === "DRAFT" || s.status === "REJECTED") && (
          <>
            <p className="mt-2 text-sm text-gray-700">Add a tagline, the problem, your solution and an industry, save, then send the startup for review. It stays private until a super admin approves it.</p>
            {me.canSubmit ? <Button size="sm" className="mt-3" loading={busy === "submit"} onClick={submit}>Send for review</Button> : <p className="mt-2 text-sm text-gray-600">Only a founder can send the startup for review.</p>}
          </>
        )}
        {s.status === "PENDING" && <p className="mt-2 text-sm text-gray-700">A reviewer is looking at it. You will be told the outcome.</p>}
        {s.status === "APPROVED" && <p className="mt-2 text-sm text-gray-700">Your startup is public. Changes you save appear on the public page straight away.</p>}
      </Card>

      <Card className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Logo</h2>
        <div className="mt-3">{me.canEdit ? <AvatarUpload avatarUrl={s.logoUrl} apiPath={`/api/startups/${id}/logo`} onChange={(u) => setS((x) => (x ? { ...x, logoUrl: u } : x))} /> : <p className="text-sm text-gray-600">Only people who may edit can change the logo.</p>}</div>
      </Card>

      <form onSubmit={save}>
        <Card className="mt-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile</h2>
          {ro && <p className="text-sm text-gray-600">You can read the profile but a founder has not given you permission to edit it.</p>}
          <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={LIMITS.name} disabled={ro} />
          <Input label="Tagline" value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} maxLength={LIMITS.tagline} disabled={ro} hint="One line that says what you do." />
          <Textarea label="The problem you solve" value={form.problem ?? ""} onChange={(e) => set("problem", e.target.value)} rows={3} maxLength={LIMITS.problem} disabled={ro} />
          <Textarea label="Your solution" value={form.solution ?? ""} onChange={(e) => set("solution", e.target.value)} rows={3} maxLength={LIMITS.solution} disabled={ro} />
          <Textarea label="About" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={LIMITS.description} disabled={ro} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Industry" value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value || null)} disabled={ro}><option value="">Choose one</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</Select>
            <Select label="Stage" value={form.stage} onChange={(e) => set("stage", e.target.value)} disabled={ro}>{STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}</Select>
            <Input label="Location" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} maxLength={LIMITS.location} disabled={ro} placeholder="e.g. Lagos" />
            <Input label="Website" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} disabled={ro} placeholder="https://" inputMode="url" />
          </div>
          <Textarea label="Traction you want to share (optional)" value={form.traction ?? ""} onChange={(e) => set("traction", e.target.value)} rows={2} maxLength={LIMITS.traction} disabled={ro} hint="Users, pilots, revenue: only what you are happy to make public." />
          <Textarea label="Funding or support you are looking for (optional)" value={form.fundingNeed ?? ""} onChange={(e) => set("fundingNeed", e.target.value)} rows={2} maxLength={LIMITS.fundingNeed} disabled={ro} hint="Public. Do not put confidential figures here." />
          <fieldset disabled={ro}>
            <legend className="text-sm font-semibold text-brand-ink">We are looking for</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{SEEKING.map((k) => <Checkbox key={k} label={SEEKING_LABEL[k]} checked={form.seeking.includes(k)} onChange={() => set("seeking", form.seeking.includes(k) ? form.seeking.filter((x) => x !== k) : [...form.seeking, k])} />)}</div>
          </fieldset>
          {formError && <p className="text-sm text-brand-rose" role="alert">{formError}</p>}
          {!ro && <div className="flex justify-end"><Button type="submit" size="sm" loading={saving}>Save profile</Button></div>}
        </Card>
      </form>

      <Card className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team</h2>
        <ul className="mt-3 space-y-3">
          {team.map((m) => (
            <li key={m.id} className="rounded-xl border border-brand-gray p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-brand-ink">{m.handle ? <Link href={`/@${m.handle}`} className="hover:underline">{m.name}</Link> : m.name}</span>
                <Badge variant={m.role === "FOUNDER" ? "gold" : "neutral"}>{m.role === "FOUNDER" ? "Founder" : "Member"}</Badge>
                {m.status === "INVITED" && <Badge variant="warning">Invited, not yet accepted</Badge>}
                {m.title && <span className="text-sm text-gray-700">{m.title}</span>}
              </div>
              {m.status === "ACTIVE" && m.role !== "FOUNDER" && (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  <Checkbox label="May edit the profile" checked={m.canEdit} disabled={!me.canManageTeam} onChange={() => patch(m, { canEdit: !m.canEdit })} />
                  <Checkbox label="May publish for the startup" checked={m.canPublish} disabled={!me.canManageTeam} onChange={() => patch(m, { canPublish: !m.canPublish })} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {me.canManageTeam && m.status === "ACTIVE" && m.role === "MEMBER" && <Button size="sm" variant="secondary" onClick={() => patch(m, { role: "FOUNDER" })}>Make founder</Button>}
                {me.canManageTeam && m.status === "ACTIVE" && m.role === "FOUNDER" && team.filter((x) => x.role === "FOUNDER" && x.status === "ACTIVE").length > 1 && <Button size="sm" variant="secondary" onClick={() => patch(m, { role: "MEMBER" })}>Make member</Button>}
                {m.status === "ACTIVE" && <Button size="sm" variant="secondary" onClick={() => patch(m, { showOnProfile: !m.showOnProfile })}>{m.showOnProfile ? "Hide from public page" : "Show on public page"}</Button>}
                {me.canManageTeam && <Button size="sm" variant="danger" onClick={() => remove(m)}>{m.status === "INVITED" ? "Withdraw invitation" : "Remove"}</Button>}
              </div>
            </li>
          ))}
        </ul>
        {me.canManageTeam && (
          <form onSubmit={sendInvite} className="mt-5 space-y-3 border-t border-brand-gray pt-4">
            <h3 className="text-sm font-semibold text-brand-ink">Invite a teammate</h3>
            <p className="text-xs text-gray-600">Enter their handle. They must have a member account and they only join if they accept.</p>
            <div className="grid gap-3 sm:grid-cols-2"><Input label="Their handle" value={invite.handle} onChange={(e) => setInvite((v) => ({ ...v, handle: e.target.value }))} placeholder="e.g. ada-obi" autoCapitalize="none" error={inviteError} /><Input label="Their role (optional)" value={invite.title} onChange={(e) => setInvite((v) => ({ ...v, title: e.target.value }))} maxLength={LIMITS.title} placeholder="e.g. CTO" /></div>
            <div className="flex flex-wrap gap-x-5 gap-y-2"><Checkbox label="May edit the profile" checked={invite.canEdit} onChange={() => setInvite((v) => ({ ...v, canEdit: !v.canEdit }))} /><Checkbox label="May publish for the startup" checked={invite.canPublish} onChange={() => setInvite((v) => ({ ...v, canPublish: !v.canPublish }))} /></div>
            <div className="flex justify-end"><Button type="submit" size="sm" loading={busy === "invite"} disabled={invite.handle.trim().length < 3}>Send invitation</Button></div>
          </form>
        )}
        {team.some((m) => m.status === "ACTIVE" && m.role === "MEMBER") && !me.canManageTeam && <p className="mt-3 text-xs text-gray-600">Only founders change who is on the team and what they may do.</p>}
      </Card>

      {me.canManageTeam && <HandleChangeCard startupId={id} title="The startup's handle" />}
    </main>
  );
}
