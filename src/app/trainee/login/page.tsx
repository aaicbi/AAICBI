"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function TraineeLoginPage() {
  return (
    <Suspense fallback={null}>
      <TraineeLoginForm />
    </Suspense>
  );
}

function TraineeLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

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
          <Logo href={null} compact markClassName="h-12 w-12" />
        </div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold text-brand-ink">Welcome back</h1>

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-brand-ink">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-brand-ink">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
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
