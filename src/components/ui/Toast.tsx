"use client";
import { createContext, useCallback, useContext, useState } from "react";

/**
 * One shared toast system, replacing the inconsistent mix of fading
 * "Saved." text (some pages), silent success (most pages), and
 * differently-worded inline error text (every page) that existed
 * before. Mount <ToastProvider> once, near the root of any page tree
 * that needs it, and call useToast() anywhere underneath.
 */
type ToastVariant = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider>");
  return ctx;
}

// Audit finding, closed here: same hardcoded-`bg-white` gap as Card's
// own — see that component's comment for the full reasoning. A toast
// popping up bright white against a dark page would be exactly the
// kind of jarring moment this fix removes.
const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-brand-teal bg-brand-surface text-brand-tealDeep",
  error: "border-brand-rose bg-brand-surface text-brand-rose",
  info: "border-brand-gray bg-brand-surface text-brand-ink",
};
const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-lg animate-[toast-in_0.2s_ease-out] ${VARIANT_CLASSES[t.variant]}`}
          >
            <span aria-hidden="true">{VARIANT_ICON[t.variant]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
