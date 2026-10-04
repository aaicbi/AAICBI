"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/org/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Direct platform-fee billing — reached after the organization returns
 * from Paystack's hosted checkout. Mirrors
 * trainee/courses/[id]/payment-callback/page.tsx exactly: doesn't grant
 * or trust anything about how the organization arrived here, offers a
 * "Recheck my payment" using the reference Paystack appends to this
 * callback_url automatically, for the same short-gap-before-the-webhook-
 * lands reason that page's own comment explains.
 */
export default function OrgBillingPaymentCallbackPage() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function recheck() {
    if (!reference) return;
    setChecking(true);
    setResult(null);
    const res = await fetch("/api/org-billing/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    setChecking(false);
    const data = await res.json().catch(() => ({}));
    setResult({
      ok: res.ok,
      message:
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "Something went wrong. Please try again.",
    });
  }

  return (
    <>
      <SiteHeader right={<LogoutButton />} />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <Card>
          <h1 className="font-display text-xl font-semibold text-brand-ink">Confirming your payment</h1>
          <p className="mt-2 text-sm text-gray-600">
            If your payment went through, your platform access activates automatically — usually within a few seconds.
          </p>
          <Button href="/org/billing" className="mt-5">
            Go to Billing Status
          </Button>

          {reference && (
            <div className="mt-6 border-t border-brand-gray pt-5">
              <p className="text-xs text-gray-500">Still not active after a minute or two?</p>
              <button
                onClick={recheck}
                disabled={checking}
                className="mt-2 text-sm font-semibold text-brand-teal hover:underline disabled:opacity-60"
              >
                {checking ? "Checking..." : "Recheck my payment"}
              </button>
              {result && (
                <p className={`mt-2 text-sm ${result.ok ? "text-brand-teal" : "text-brand-rose"}`}>{result.message}</p>
              )}
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
