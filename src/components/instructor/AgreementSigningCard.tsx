"use client";
import { useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface Agreement {
  id: string;
  content: string;
  status: "PENDING" | "ACCEPTED";
  sentBy: { name: string };
}

/**
 * The scroll-to-read + two checkboxes + typed-name signature flow,
 * shared by /instructor/dashboard (where it renders as the first card
 * for a PENDING agreement — see that page's own comment) and
 * /instructor/agreement (the same flow, reachable any time from the
 * nav). Calling `onAccepted` is the caller's job to react to — the
 * dashboard swaps in the rest of its content, the standalone page
 * redirects.
 */
export default function AgreementSigningCard({ agreement, onAccepted }: { agreement: Agreement; onAccepted: () => void }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [bindingConfirmed, setBindingConfirmed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setScrolledToEnd(true);
  }

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/instructor/agreement/${agreement.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptedName: typedName }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    onAccepted();
  }

  const canAccept = scrolledToEnd && readConfirmed && bindingConfirmed && typedName.trim().length >= 2;

  return (
    <Card variant="highlighted">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-brand-ink">Instructor Agreement — Action Required</p>
        <Badge variant="warning">Awaiting your signature</Badge>
      </div>
      <p className="mt-1 text-xs text-gray-500">Sent by {agreement.sentBy.name}. Review and accept below to unlock the rest of the Instructor Portal.</p>

      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="mt-4 h-96 overflow-y-auto rounded-lg border border-brand-gray bg-brand-surface p-4 text-sm leading-relaxed text-brand-ink whitespace-pre-wrap"
      >
        {agreement.content}
      </div>
      {!scrolledToEnd && <p className="mt-2 text-xs text-gray-500">Scroll to the end of the agreement to continue.</p>}

      <div className="mt-5 space-y-3 border-t border-brand-gray pt-4">
        <label className="flex items-start gap-2 text-sm text-brand-ink">
          <input type="checkbox" disabled={!scrolledToEnd} checked={readConfirmed} onChange={(e) => setReadConfirmed(e.target.checked)} className="mt-0.5" />
          I confirm that I have read and understood this agreement in full.
        </label>
        <label className="flex items-start gap-2 text-sm text-brand-ink">
          <input type="checkbox" disabled={!scrolledToEnd} checked={bindingConfirmed} onChange={(e) => setBindingConfirmed(e.target.checked)} className="mt-0.5" />
          I agree that accepting below constitutes a legally binding electronic signature.
        </label>
        <div>
          <label className="text-sm font-semibold text-brand-ink">Type your full name to sign</label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            disabled={!scrolledToEnd}
            placeholder="Full name"
            className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal disabled:opacity-50"
          />
        </div>
        {error && <p className="text-sm text-brand-rose">{error}</p>}
        <Button onClick={handleAccept} disabled={!canAccept} loading={submitting} className="w-full">
          {submitting ? "Signing..." : "Accept and Sign Agreement"}
        </Button>
      </div>
    </Card>
  );
}
