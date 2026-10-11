"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

interface Org { id: string; name: string; approvalState: string; staffUserId?: string | null }

/**
 * Super admin only: hand this course to a training organization (its assessments, examination and assignments go with it),
 * or take it back. Trainees' enrolments, results and certificates are not touched. The page for an organization or an
 * instructor never renders this.
 */
export default function MoveCourse({ courseId, ownerName, isPlatformOwned, paid, paymentsTo, routing, onMoved, showToast }: { courseId: string; ownerName: string; isPlatformOwned: boolean; paid: boolean; paymentsTo: "OWNER" | "PLATFORM"; routing: string | null; onMoved: () => void; showToast: (m: string, t?: "success" | "error") => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pay, setPay] = useState<"" | "OWNER" | "PLATFORM">("");

  useEffect(() => {
    fetch("/api/admin/training-organizations").then((r) => (r.ok ? r.json() : [])).then((d) => setOrgs((Array.isArray(d) ? d : d.organizations ?? []).filter((o: Org) => o.approvalState === "APPROVED"))).catch(() => setOrgs([]));
  }, []);

  async function move(body: object) {
    setBusy(true);
    const r = await fetch(`/api/admin/courses/${courseId}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!r.ok) return showToast(d.error ?? "Could not move the course.", "error");
    showToast(`Moved to ${d.to.name}. ${d.exams} exam${d.exams === 1 ? "" : "s"} and ${d.assignments} assignment${d.assignments === 1 ? "" : "s"} went with it.${d.certificateTemplateCleared ? " Choose a certificate template again." : ""}`, "success");
    setOrgId("");
    setPay("");
    onMoved();
  }

  async function savePayments(value: "OWNER" | "PLATFORM") {
    setBusy(true);
    const r = await fetch(`/api/admin/courses/${courseId}/payments`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentsTo: value }) });
    setBusy(false);
    if (!r.ok) return showToast("Could not change where payments go.", "error");
    showToast("Saved. It applies to new payments; subscriptions already running are not changed.", "success");
    onMoved();
  }

  const chosen = orgs?.find((o) => o.id === orgId);
  return (
    <Card className="mt-6">
      <h2 className="font-display text-lg font-semibold text-brand-ink">Owner of this course</h2>
      <p className="mt-1 text-sm text-gray-700">Now owned by <strong>{ownerName}</strong>. Move it to a training organization and its team can edit it, along with its assessments, examination and assignments. Enrolled trainees, their results and certificates stay as they are.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Select label="Move to" value={orgId} onChange={(e) => { setOrgId(e.target.value); setConfirming(false); }} disabled={!orgs}>
            <option value="">{orgs ? "Choose an organization" : "Loading organizations…"}</option>
            {orgs?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        {!confirming ? <Button type="button" disabled={!orgId || busy || (paid && !pay)} onClick={() => setConfirming(true)}>Move course</Button> : (
          <>
            <Button type="button" loading={busy} onClick={() => move({ organizationId: orgId, ...(pay ? { paymentsTo: pay } : {}) })}>Yes, move to {chosen?.name}</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        )}
        {!isPlatformOwned && <Button type="button" variant="secondary" disabled={busy} onClick={() => move({ toPlatform: true })}>Bring back to AAICBI</Button>}
      </div>
      {orgId && paid && (
        <fieldset className="mt-3 rounded-xl border border-brand-gray p-3">
          <legend className="px-1 text-sm font-semibold text-brand-ink">This is a paid course. Where should new payments go?</legend>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-gray-800"><input type="radio" name="pay" className="mt-1" checked={pay === "OWNER"} onChange={() => { setPay("OWNER"); setConfirming(false); }} /><span><strong>Follow {chosen?.name}&rsquo;s billing setup.</strong> If it shares revenue and has a payout account, its share is split off on every new payment.</span></label>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-gray-800"><input type="radio" name="pay" className="mt-1" checked={pay === "PLATFORM"} onChange={() => { setPay("PLATFORM"); setConfirming(false); }} /><span><strong>AAICBI keeps the whole payment.</strong> {chosen?.name} edits the course but receives nothing from its sales.</span></label>
          <p className="mt-1 text-xs text-gray-600">Subscriptions already running are not changed either way. You can change this later on this page.</p>
        </fieldset>
      )}
      {!isPlatformOwned && (paid || paymentsTo === "PLATFORM") && routing && (
        <div className="mt-4 rounded-xl bg-brand-mint/40 p-3">
          <h3 className="text-sm font-semibold text-brand-ink">Where new payments go</h3>
          <p className="mt-1 text-sm text-gray-800">{routing}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={paymentsTo === "OWNER" ? "primary" : "secondary"} disabled={busy || paymentsTo === "OWNER"} onClick={() => savePayments("OWNER")}>Follow the owner&rsquo;s billing</Button>
            <Button type="button" size="sm" variant={paymentsTo === "PLATFORM" ? "primary" : "secondary"} disabled={busy || paymentsTo === "PLATFORM"} onClick={() => savePayments("PLATFORM")}>AAICBI keeps it all</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
