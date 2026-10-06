"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * Certificate watermark removal — the self-service checkout trigger on
 * /org/billing's second card, mirroring PayPlatformFeeButton.tsx
 * exactly for this separate product.
 */
export default function PayCertWatermarkFeeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/org-billing/pay-watermark", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(typeof data.error === "string" ? data.error : "Could not start payment. Please try again.");
      return;
    }
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
