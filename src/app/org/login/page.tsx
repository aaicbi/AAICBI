"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
/**
 * Training Organizations, Phase 1 — mirrors employer/login/page.tsx's
 * exact shape. One real difference: a PENDING/REJECTED account's login
 * attempt is REFUSED server-side (see training-org-login's own
 * comment) rather than succeeding and bouncing to a status page, so
 * that case just surfaces as the same inline error message every other
 * failed login shows here — there's no separate status page to link to.
 */
export default function TrainingOrgLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/training-org-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Invalid email or password.");
      return;
    }
    // Hard navigation, not router.push() — see trainee/login/page.tsx's
    // own comment for the full reasoning: guarantees /admin/dashboard
    // renders fresh with the new session cookie. Phase 2 — this now
    // lands the org in the real admin course-builder instead of
    // Phase 1's retired bespoke /org/dashboard (see training-org-login's
    // own comment for why the session itself changed shape).
    window.location.href = "/admin/organization";
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <div className="flex justify-center">
          <Logo href={null} compact markClassName="h-12 w-12" />
        </div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold text-brand-ink">
          Training Organization Sign In
        </h1>

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          New here?{" "}
          <a href="/org/register" className="text-brand-teal hover:underline">
            Register your organization
          </a>
        </p>
      </main>
    </>
  );
}
