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
export default function MoveCourse({ courseId, ownerName, isPlatformOwned, paid, onMoved, showToast }: { courseId: string; ownerName: string; isPlatformOwned: boolean; paid: boolean; onMoved: () => void; showToast: (m: string, t?: "success" | "error") => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
        {!confirming ? <Button type="button" disabled={!orgId || busy} onClick={() => setConfirming(true)}>Move course</Button> : (
          <>
            <Button type="button" loading={busy} onClick={() => move({ organizationId: orgId })}>Yes, move to {chosen?.name}</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        )}
        {!isPlatformOwned && <Button type="button" variant="secondary" disabled={busy} onClick={() => move({ toPlatform: true })}>Bring back to AAICBI</Button>}
      </div>
      {confirming && paid && <p className="mt-2 text-sm text-brand-rose">This is a paid course. New payments will follow the new owner&rsquo;s billing setup; subscriptions already running are not changed.</p>}
    </Card>
  );
}
