"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface ReportModalProps {
  open: boolean;
  reportedType: "TRAINEE" | "STAFF";
  reportedId: string;
  reportedName: string;
  conversationId: string;
  onClose: () => void;
}

/**
 * Reports from a chat's "•••" menu, reusing the existing profile-report
 * queue (POST /api/profile-reports, reviewed at /admin/reports) rather
 * than a parallel system — see that route's own extension for the new
 * STAFF target type and the contextType/contextId fields this sends.
 */
export default function ReportModal({ open, reportedType, reportedId, reportedName, conversationId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  if (!open) return null;

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/profile-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportedType, reportedId, reason, details, contextType: "CONVERSATION", contextId: conversationId }),
    });
    setSubmitting(false);
    if (!res.ok) {
      showToast("Couldn't submit that report. Please try again.", "error");
      return;
    }
    showToast("Report submitted for review.", "success");
    setReason("");
    setDetails("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-brand-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-brand-ink">Report {reportedName}</h2>
        <p className="mt-1 text-xs text-gray-500">Staff will review this. This does not notify {reportedName}.</p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (e.g. harassment, spam)"
          className="mt-4 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)"
          rows={3}
          className="mt-2 w-full rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={submitting} disabled={reason.trim().length < 3} className="flex-1">
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
