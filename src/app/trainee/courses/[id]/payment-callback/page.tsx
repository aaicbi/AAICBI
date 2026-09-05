"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

function PaymentCallbackContent({ courseId }: { courseId: string }) {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function recheck() {
    if (!reference) return;
    setChecking(true);
    setResult(null);
    const res = await fetch(`/api/courses/${courseId}/reconcile`, {
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
    <Card>
      <h1 className="font-display text-xl font-semibold text-brand-ink">Confirming your payment</h1>
      <p className="mt-2 text-sm text-gray-600">
        If your payment went through, check your email for a short unlock code — enter it to finish setting up
        your access.
      </p>
      <Button href={`/trainee/courses/${courseId}/unlock`} className="mt-5">
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
  );
}

export default function PaymentCallbackPage({ params }: { params: { id: string } }) {
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
        <Suspense fallback={<Card><p className="text-sm text-gray-500">Loading...</p></Card>}>
          <PaymentCallbackContent courseId={params.id} />
        </Suspense>
      </main>
    </>
  );
}
