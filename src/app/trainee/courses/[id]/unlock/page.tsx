"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Reachable two ways, deliberately the same code either way — see the
 * schema comment on CourseEnrollment.otpCode: typing the 6-digit code
 * by hand, or clicking the link the email also includes, which embeds
 * the code as a query param and auto-submits it here.
 */
export default function UnlockCoursePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(codeToTry: string) {
    if (!codeToTry) return;
    setVerifying(true);
    setError(null);
    const res = await fetch(`/api/courses/${params.id}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeToTry }),
    });
    setVerifying(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not verify. Try again.");
      return;
    }
    setUnlocked(true);
  }

  // Auto-submit when arriving via the emailed link — the whole point
  // of embedding the code in the URL is a genuine one-click unlock,
  // not making someone copy it out and paste it in by hand anyway.
  useEffect(() => {
    const fromLink = searchParams.get("code");
    if (fromLink) verify(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav = [
    { label: "Dashboard", href: "/trainee/dashboard" },
    { label: "Courses", href: "/trainee/courses" },
    { label: "Settings", href: "/trainee/settings" },
  ];

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-sm px-6 py-16 text-center">
        <Card>
          {unlocked ? (
            <>
              <h1 className="font-display text-xl font-semibold text-brand-ink">Unlocked!</h1>
              <p className="mt-2 text-sm text-gray-600">Your course is ready.</p>
              <Button href={`/trainee/courses/${params.id}`} className="mt-5 w-full">
                Go to Course
              </Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold text-brand-ink">Enter your unlock code</h1>
              <p className="mt-2 text-sm text-gray-600">Check your email for the 6-digit code we just sent you.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                aria-label="6-digit unlock code"
                className="mt-4 w-full rounded-lg border border-brand-gray px-3 py-2.5 text-center text-2xl font-semibold tracking-[0.3em] outline-none focus:border-brand-teal"
              />
              {error && <p className="mt-3 text-sm text-brand-rose">{error}</p>}
              <Button onClick={() => verify(code)} loading={verifying} disabled={code.length !== 6} className="mt-4 w-full">
                Unlock
              </Button>
            </>
          )}
        </Card>
      </main>
    </>
  );
}
