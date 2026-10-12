"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import GoogleSignInButton from "@/components/trainee/GoogleSignInButton";
import { Input } from "@/components/ui/Field";
import { parseSignupNotice } from "@/lib/auth/signupRedirect";
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  no_account: "No account found for that Google email. Create an account first.",
  oauth_failed: "Something went wrong signing in with Google. Please try again.",
  oauth_not_configured: "Google sign-in isn't set up yet. Please sign in with your email and password instead.",
};

export default function TraineeLoginPage() {
  return (
    <Suspense fallback={null}>
      <TraineeLoginForm />
    </Suspense>
  );
}

function TraineeLoginForm() {
  const searchParams = useSearchParams();
  // Arriving straight from creating an account: the email is filled in and a notice says to verify it first.
  const fresh = parseSignupNotice((k) => searchParams.get(k));
  const [email, setEmail] = useState(fresh.email);
  const [password, setPassword] = useState("");
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const oauthErrorCode = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    oauthErrorCode ? OAUTH_ERROR_MESSAGES[oauthErrorCode] ?? null : null
  );
  const [loading, setLoading] = useState(false);

  async function resendLink() {
    setResend("sending"); setResendMsg(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    if (res?.ok) { setResend("sent"); return; }
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setResend("failed"); setResendMsg(data.error ?? "Could not send it. Please try again.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/trainee-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Invalid email or password.");
      return;
    }
    // Honor ?next=... set by middleware.ts when this login was reached
    // by being redirected off a protected page (e.g. an /exam/* link) —
    // falls back to the dashboard for a normal, direct visit to /login.
    // Only ever follow an internal path (starts with exactly one "/"),
    // never an absolute/external URL, so this can't become an open
    // redirect via a crafted ?next= value.
    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/trainee/dashboard";
    // Bug fix — was `router.push(safeNext)`. That's a soft, client-side
    // transition, and it's exactly the well-known Next.js App Router
    // gotcha behind "works after a manual refresh but not right after
    // logging in": the very reason someone lands on this login page is
    // frequently that middleware.ts just redirected them here off a
    // protected route (e.g. visiting /trainee/courses while logged
    // out) — meaning that destination was already requested once,
    // unauthenticated, moments earlier. A soft push can reuse a cached
    // render of that route from before the session cookie existed,
    // instead of asking the server to render fresh with it. A full
    // navigation has no such ambiguity — the browser makes a genuinely
    // new request, the new session cookie is present on it, and the
    // server component renders correctly the first time. Login is a
    // rare, one-time transition, so the trivial extra page load here
    // costs nothing and buys certainty.
    window.location.href = safeNext;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <div className="flex justify-center">
          <Logo href={null} layout="pyramid" markClassName="h-28 w-auto" />
        </div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold text-brand-ink">{fresh.show ? "Almost there" : "Welcome back"}</h1>

        {fresh.show && (
          <div role="status" data-testid="signup-notice" className="mt-4 rounded-2xl bg-brand-mint px-4 py-3 text-sm text-brand-ink">
            <p className="font-semibold">Your account is created. Verify your email to finish.</p>
            <p className="mt-1">We sent a verification link to {fresh.email ? <span className="font-semibold [overflow-wrap:anywhere]">{fresh.email}</span> : "your email address"}. Open it, then sign in below.</p>
            <p className="mt-1 text-xs text-gray-700">Nothing in your inbox? Check your spam folder.</p>
            <button type="button" onClick={resendLink} disabled={resend === "sending" || !email.trim()} className="mt-2 min-h-[36px] text-sm font-semibold text-brand-teal underline-offset-2 hover:underline disabled:opacity-60">
              {resend === "sending" ? "Sending…" : resend === "sent" ? "Sent again. Check your inbox." : "Send the link again"}
            </button>
            {resend === "failed" && resendMsg && <p role="alert" className="text-xs text-brand-rose">{resendMsg}</p>}
            {fresh.startupProblem && <p className="mt-2 text-xs text-brand-goldText">We could not save your startup. After signing in, add it from My Startups.</p>}
          </div>
        )}

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" autoComplete="current-password" autoFocus={fresh.show && !!fresh.email} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-brand-gray" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px flex-1 bg-brand-gray" />
          </div>

          <GoogleSignInButton intent="login" />
        </Card>

        <p className="mt-4 text-center text-xs">
          <a href="/trainee/forgot-password" className="text-brand-teal hover:underline">
            Forgot your password?
          </a>
        </p>
        <p className="mt-3 text-center text-xs text-gray-500">
          New here?{" "}
          <a href="/trainee/register" className="text-brand-teal hover:underline">
            Create an account
          </a>
        </p>
      </main>
    </>
  );
}
