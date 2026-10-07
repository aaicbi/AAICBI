"use client";
import Button from "./Button";
import Modal from "./Modal";

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
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1" autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
