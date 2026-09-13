"use client";
import { useEffect } from "react";

/**
 * Course catalogue upgrade — reuses ConfirmModal.tsx's exact overlay/
 * backdrop/Escape-to-close pattern, stripped down to an image-only
 * lightbox with no confirm/cancel buttons.
 */
export default function CourseFlyerLightbox({
  open,
  flyerUrl,
  onClose,
}: {
  open: boolean;
  flyerUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Course flyer"
      onClick={onClose}
    >
      <div className="max-h-[90vh] max-w-3xl animate-[modal-in_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL. */}
        <img src={flyerUrl} alt="Course flyer" className="max-h-[90vh] w-auto rounded-2xl object-contain shadow-xl" />
      </div>
    </div>
  );
}
