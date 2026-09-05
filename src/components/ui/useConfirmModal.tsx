"use client";
import { useCallback, useState } from "react";
import ConfirmModal from "./ConfirmModal";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Makes ConfirmModal a drop-in replacement for `confirm()`: instead of
 * `if (!confirm("...")) return;`, this is
 * `if (!(await confirm({ title: "...", description: "..." }))) return;`
 * — same shape at the call site, real styled modal instead of the
 * browser's native dialog. Render `{modal}` once near the top of the
 * component's JSX; `confirm()` handles the rest.
 */
export function useConfirmModal() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const modal = state ? (
    <ConfirmModal
      open
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, modal };
}
