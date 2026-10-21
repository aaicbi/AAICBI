"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { EventView, Rights } from "@/lib/events/events";

type Op = "cancel" | "archive" | "delete" | "publish" | "unpublish" | "approve" | "reject" | "request_changes" | "submit" | "withdraw" | "approve_publish";
const TITLE: Record<Op, string> = {
  cancel: "Cancel this event", archive: "Archive this event", delete: "Delete this draft", publish: "Publish to the public pages", unpublish: "Take off the public pages", approve: "Approve for promotion",
  reject: "Reject the promotion request", request_changes: "Ask for changes", submit: "Submit for public promotion", withdraw: "Withdraw the request", approve_publish: "Approve and publish",
};
const NEEDS_REASON: Op[] = ["cancel", "reject", "request_changes"];
const REASON_LABEL: Partial<Record<Op, string>> = { cancel: "Reason for cancelling (people are told)", reject: "Reason (the organisation sees this)", request_changes: "What needs to change (the organisation sees this)", unpublish: "Reason (optional)" };
const EXPLAIN: Partial<Record<Op, string>> = {
  cancel: "Everyone invited or registered is notified. A cancelled event cannot be edited.",
  publish: "The event appears on the feed, the events page and search. Everyone it is meant for is notified once.",
  submit: "AAICBI reviews the event before anything is public. Your internal event is not affected either way.",
  reject: "The internal event is not affected; the organisation can still run it.",
  archive: "Archived events leave the lists. They are kept for the record.",
  delete: "A draft that was never scheduled is removed for good.",
};

/** Everything a manager can do with one event, as buttons that open a small confirmation. The server decides again whether each is allowed. */
export default function EventActions({ event: e, rights, scope, apiBase, uiBase, permissions, afterChange }: { event: EventView; rights: Rights; scope: "platform" | "organization"; apiBase: string; uiBase: string; permissions: string[]; afterChange?: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [op, setOp] = useState<Op | null>(null);
  const [reason, setReason] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const has = (k: string) => permissions.includes(k);
  const promo = e.managed?.promotionStatus ?? "NONE";
  const live = e.phase === "UPCOMING" || e.phase === "LIVE";
  const ownedByPlatform = e.managed?.managedBy === "PLATFORM";

  const buttons: { op: Op; label: string; variant?: "primary" | "secondary" | "danger" }[] = [];
  if (e.status === "SCHEDULED" && e.audience === "PUBLIC" && live) {
    if (scope === "platform" && ownedByPlatform && has("events.platform:publish")) {
      if (promo === "PUBLISHED" || (promo === "APPROVED" && e.publishAt)) buttons.push({ op: "unpublish", label: "Unpublish", variant: "secondary" });
      else buttons.push({ op: "publish", label: "Publish" });
    } else if (scope === "platform" && !ownedByPlatform) {
      if (promo === "SUBMITTED" && has("events.promotions:approve")) buttons.push({ op: "approve", label: "Approve" }, { op: "request_changes", label: "Request changes", variant: "secondary" }, { op: "reject", label: "Reject", variant: "danger" });
      if (promo === "SUBMITTED" && has("events.promotions:approve") && has("events.promotions:publish")) buttons.splice(1, 0, { op: "approve_publish", label: "Approve and publish" });
      if (promo === "APPROVED" && has("events.promotions:publish")) buttons.push({ op: "publish", label: e.publishAt ? "Change publication time" : "Publish" });
      if (promo === "PUBLISHED" && has("events.promotions:publish")) buttons.push({ op: "unpublish", label: "Unpublish", variant: "secondary" });
      if (promo === "PUBLISHED" && has("events.promotions:approve")) buttons.push({ op: "request_changes", label: "Request changes", variant: "secondary" });
    } else if (scope === "organization" && rights.edit) {
      if ((promo === "NONE" || promo === "REJECTED" || promo === "CHANGES_REQUESTED") && has("org_events.promotion:create")) buttons.push({ op: "submit", label: promo === "NONE" ? "Submit for public promotion" : "Resubmit for promotion" });
      if ((promo === "SUBMITTED" || promo === "CHANGES_REQUESTED") && has("org_events.promotion:create")) buttons.push({ op: "withdraw", label: "Withdraw request", variant: "secondary" });
    }
  }
  if (rights.cancel && e.phase !== "DRAFT" && (e.phase === "UPCOMING" || e.phase === "LIVE")) buttons.push({ op: "cancel", label: "Cancel event", variant: "danger" });
  if (rights.cancel && (e.phase === "COMPLETED" || e.phase === "CANCELLED")) buttons.push({ op: "archive", label: "Archive", variant: "secondary" });
  if (rights.cancel && e.phase === "DRAFT") buttons.push({ op: "delete", label: "Delete draft", variant: "danger" });

  async function run() {
    if (!op) return;
    if (NEEDS_REASON.includes(op) && reason.trim().length < 3) { setProblem("Please give a short reason."); return; }
    setBusy(true); setProblem(null);
    const id = e.id;
    let res: Response;
    const post = (path: string, body?: unknown) => fetch(`${apiBase}/${id}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    if (op === "cancel") res = await post("/cancel", { reason });
    else if (op === "archive") res = await post("/archive");
    else if (op === "delete") res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
    else if (op === "approve_publish") {
      res = await post("/promotion", { action: "approve" });
      if (res.ok) res = await post("/promotion", { action: "publish", publishAtLocal: publishAt || null });
    } else res = await post("/promotion", { action: op, reason, publishAtLocal: op === "publish" ? publishAt || null : null });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(j.error ?? "That did not work."); return; }
    setOp(null); setReason(""); setPublishAt("");
    showToast(op === "delete" ? "Draft deleted." : "Done.");
    if (op === "delete") { router.push(uiBase); router.refresh(); return; }
    afterChange?.(); router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="event-actions">
      {rights.edit && e.phase !== "COMPLETED" && e.phase !== "CANCELLED" && e.phase !== "ARCHIVED" && (
        <Link href={`${uiBase}/${e.id}/edit`} className="inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">{e.phase === "DRAFT" ? "Continue editing" : "Edit or reschedule"}</Link>
      )}
      {buttons.map((b) => <Button key={b.op} type="button" variant={b.variant ?? "primary"} onClick={() => { setOp(b.op); setProblem(null); }}>{b.label}</Button>)}
      <Modal open={!!op} onClose={() => setOp(null)} title={op ? TITLE[op] : ""}>
        {op && (
          <div className="space-y-3">
            {EXPLAIN[op] && <p className="text-sm text-gray-700">{EXPLAIN[op]}</p>}
            {(NEEDS_REASON.includes(op) || op === "unpublish") && <Textarea label={REASON_LABEL[op] ?? "Reason"} value={reason} onChange={(ev) => setReason(ev.target.value)} rows={3} maxLength={500} required={NEEDS_REASON.includes(op)} />}
            {(op === "publish" || op === "approve_publish") && <Input label="Publish at (optional)" type="datetime-local" value={publishAt} onChange={(ev) => setPublishAt(ev.target.value)} hint={`Leave empty to publish now. Time is in ${e.timeZone}.`} />}
            {problem && <p role="alert" className="text-sm text-brand-rose">{problem}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOp(null)}>Back</Button><Button type="button" variant={op === "cancel" || op === "reject" || op === "delete" ? "danger" : "primary"} loading={busy} onClick={() => void run()}>{TITLE[op]}</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
