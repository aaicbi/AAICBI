"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * The reason-entry step for a SUPER_ADMIN-issued messaging suspension —
 * shared by ConversationThread's "•••" menu and the Performance
 * Dashboard's trainee drill-down, so both entry points collect the
 * same required, evidence-bearing reason before
 * POST /api/admin/trainees/[id]/messaging-suspension fires.
 */
export default function SuspendReasonModal({
  open,
  traineeName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  traineeName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-brand-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-brand-ink">Suspend {traineeName}</h2>
        <p className="mt-1 text-xs text-gray-500">They&apos;ll keep read access to every conversation — only sending is blocked.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for this suspension"
          rows={3}
          className="mt-4 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} disabled={!reason.trim()} className="flex-1">
            Suspend
          </Button>
        </div>
      </div>
    </div>
  );
}
