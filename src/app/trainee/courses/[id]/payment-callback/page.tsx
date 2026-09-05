"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Reached after a trainee returns from Paystack's hosted checkout.
 * Deliberately does NOT grant anything here or trust anything about
 * *how* they arrived at this page — "the callback_url was visited"
 * proves nothing about whether the payment actually succeeded,
 * confirmed directly in Paystack's own documentation. The webhook
 * (verified server-to-server, confirmed against Paystack's own verify
 * endpoint) is the only source of truth for that — and even once it
 * confirms, access doesn't appear automatically. See the schema
 * comment on CourseEnrollment.otpCode: a confirmed payment triggers a
 * short, emailed unlock code (M28), one more real step before access
 * actually opens up.
 *
 * M29 — the real recourse this page now offers, not just a "wait and
 * check your email" message: Paystack appends `?reference=` (and
 * `trxref`, an older alias for the same value) to this exact
 * callback_url automatically, so the reference is already sitting
 * right here to check directly, without the trainee needing to find
 * or type anything.
 */
export default function PaymentCallbackPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function recheck() {
    if (!reference) return;
    setChecking(true);
    setResult(null);
    const res = await fetch(`/api/courses/${params.id}/reconcile`, {
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
      <SiteHeader
        nav={[
          { label: "Dashboard", href: "/trainee/dashboard" },
          { label: "Courses", href: "/trainee/courses" },
          { label: "Settings", href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <Card>
          <h1 className="font-display text-xl font-semibold text-brand-ink">Confirming your payment</h1>
          <p className="mt-2 text-sm text-gray-600">
            If your payment went through, check your email for a short unlock code — enter it to finish setting up
            your access.
          </p>
          <Button href={`/trainee/courses/${params.id}/unlock`} className="mt-5">
            Enter Unlock Code
          </Button>

          {reference && (
            <div className="mt-6 border-t border-brand-gray pt-5">
              <p className="text-xs text-gray-500">No email after a few minutes?</p>
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
