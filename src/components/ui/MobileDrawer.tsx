"use client";
import { useRef } from "react";
import { useDialog } from "./useDialog";

/**
 * The slide-in navigation panel used by every role's sidebar below the
 * desktop breakpoint. Five sidebars each hand-built this as a bare
 * fixed overlay with no dialog semantics; it now announces itself as a
 * dialog, traps focus, closes on Escape and returns focus to the menu
 * button.
 */
export default function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-surface shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}
