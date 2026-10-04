"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * Direct platform-fee billing — the self-service checkout trigger on
 * /org/billing. Same "one small interactive piece on an otherwise
 * server-rendered page" shape as PrintCertificateButton.tsx/
 * ApproveTemplateButton.tsx: everything else on that page is plain
 * server-rendered status text, this is the one piece that needs a
 * click handler and a redirect.
 */
export default function PayPlatformFeeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/org-billing/pay", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(typeof data.error === "string" ? data.error : "Could not start payment. Please try again.");
      return;
    }
    // Hard navigation to Paystack's own hosted checkout — not a page
    // this app renders, so there's nothing to route to client-side.
    window.location.href = data.authorizationUrl;
  }

  return (
    <div>
      <Button onClick={handlePay} loading={loading}>
        Pay with Paystack
      </Button>
      {error && <p className="mt-2 text-sm text-brand-rose">{error}</p>}
    </div>
  );
}
