"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type Status = "checking" | "success" | "error";

/**
 * M9 audit finding #3: the verification API route
 * (/api/auth/verify-email) existed and worked, but there was no
 * user-facing page for a clicked email link to land on — it would have
 * shown a trainee raw JSON. This is that page.
 *
 * The comment here used to say this wasn't reachable from anywhere
 * yet since M14 hadn't wired up the actual email send — that became
 * false the moment M14 shipped (see the dashboard and register pages'
 * own comments for the same class of now-corrected stale claim). This
 * page is a real, live destination now: the exact link the M14
 * welcome email sends a trainee to.
 */
export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This link is missing a verification token.");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          return;
        }
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error ?? "This verification link is invalid or has expired.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
        {status === "checking" && <p className="text-gray-600">Verifying your email...</p>}

        {status === "success" && (
          <Card className="w-full">
            <Badge variant="success">✓ Email Verified</Badge>
            <p className="mt-3 text-sm text-gray-600">Your account is verified. You can now sign in.</p>
            <Button href="/trainee/login" className="mt-4">
              Sign In
            </Button>
          </Card>
        )}

        {status === "error" && (
          <Card className="w-full">
            <Badge variant="danger">✕ Verification Failed</Badge>
            <p className="mt-3 text-sm text-gray-600">{message}</p>
            <a href="/trainee/login" className="mt-4 inline-block text-sm font-semibold text-brand-teal hover:underline">
              Back to Sign In
            </a>
          </Card>
        )}
      </main>
    </>
  );
}
