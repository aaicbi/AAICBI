"use client";
import { useEffect } from "react";
import Button from "./Button";

/**
 * Replaces the browser's native confirm() for anything consequential
 * — deleting a question, revoking a certificate, removing someone from
 * a cohort. Five places in this app used the unstyled native dialog,
 * which can't explain WHY an action matters ("this trainee's
 * certificate will show as invalid immediately") the way a real modal
 * can, and looks like the app broke rather than a deliberate choice.
 *
 * Keyboard-accessible: Escape closes, focus starts on the safer
 * action (Cancel), not the destructive one — a person hitting Enter
 * out of habit shouldn't accidentally confirm a delete.
 */
interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
    >
      <div
        // Audit finding, closed here: same hardcoded-`bg-white` gap as
        // Card's own — see that component's comment for the full
        // reasoning.
        className="w-full max-w-sm rounded-2xl bg-brand-surface p-6 shadow-xl animate-[modal-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="font-display text-lg font-semibold text-brand-ink">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1" autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
