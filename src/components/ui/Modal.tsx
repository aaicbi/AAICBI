"use client";
import { useId, useRef } from "react";
import { useDialog } from "./useDialog";

/**
 * The shared centered dialog. Generalizes what ConfirmModal proved:
 * role="dialog" with aria-modal and a labelled title, Escape to close,
 * click on the backdrop to close, and (through useDialog) a focus trap
 * with focus returned to the opener. ConfirmModal is now built on it.
 * Use this for any new dialog instead of another hand-built fixed
 * overlay.
 */
type ModalSize = "sm" | "md" | "lg";
const SIZE: Record<ModalSize, string> = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export default function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${SIZE[size]} overflow-y-auto rounded-2xl bg-brand-surface p-6 shadow-xl animate-[modal-in_0.15s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-lg font-semibold text-brand-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
